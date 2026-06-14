const axios = require("axios");

const ZR_EXPRESS_API_KEY = process.env.ZR_EXPRESS_API_KEY;
const ZR_EXPRESS_TENANT_ID = process.env.ZR_EXPRESS_TENANT_ID;
const ZR_EXPRESS_DEFAULT_HUB_ID = process.env.ZR_EXPRESS_DEFAULT_HUB_ID;
const ZR_EXPRESS_BASE_URL =
  process.env.ZR_EXPRESS_BASE_URL || "https://api.zrexpress.app";

const zrExpressApi = axios.create({
  baseURL: ZR_EXPRESS_BASE_URL,
  headers: {
    "X-Tenant": ZR_EXPRESS_TENANT_ID || "",
    "X-Api-Key": ZR_EXPRESS_API_KEY || "",
    "Content-Type": "application/json",
  },
});

function isZrExpressConfigured() {
  return Boolean(ZR_EXPRESS_API_KEY && ZR_EXPRESS_TENANT_ID);
}

function shouldAutoCreateOfficeDelivery() {
  return process.env.ZR_EXPRESS_AUTO_CREATE_OFFICE !== "false";
}

function normalizeDeliveryType(deliveryType) {
  return deliveryType === "office" || deliveryType === "pickup-point"
    ? "pickup-point"
    : "home";
}

function buildParcelData(order, deliveryType = order.deliveryType, hubId) {
  const normalizedDeliveryType = normalizeDeliveryType(deliveryType);
  const isOfficeDelivery =
    deliveryType === "office" || deliveryType === "pickup-point";
  const resolvedHubId =
    hubId ??
    (order.hubId ||
      order.pickupPointId ||
      order.officeId ||
      (isOfficeDelivery ? ZR_EXPRESS_DEFAULT_HUB_ID : undefined));
  const officeName = order.officeName || order.office || order.deliveryOffice || "";
  const fallbackAddress = [order.address, order.commune, order.wilaya]
    .filter(Boolean)
    .join(", ");
  const address = isOfficeDelivery
    ? order.officeAddress || officeName || fallbackAddress
    : order.address || order.deliveryAddress || fallbackAddress;

  return {
    customer: {
      name: order.customerName,
      phone: {
        number1: order.customerPhone,
        number2: order.customerPhone2 || "",
        number3: order.customerPhone3 || "",
      },
    },
    deliveryAddress: {
      street: address,
      city: order.wilaya,
      district: order.commune,
      cityTerritoryId: order.cityTerritoryId || order.wilayaId || undefined,
      districtTerritoryId: order.districtTerritoryId || undefined,
      postalCode: order.postalCode || undefined,
      country: order.country || "Algeria",
      hubId: resolvedHubId,
      hubName: officeName || undefined,
    },
    hubId: resolvedHubId,
    orderedProducts: (order.products || order.items || []).map((product) => ({
      productName: product.title || product.name,
      productSku: product.sku || product.id || "",
      quantity: product.quantity,
      unitPrice: product.price,
      stockType: product.stockType || "local",
    })),
    deliveryType: normalizedDeliveryType,
    description: order.notes || order.description || undefined,
    externalId: order.id,
    stateId: order.stateId || undefined,
    amount: order.total || order.amount || 0,
  };
}

async function buildParcelDataAsync(order, deliveryType = order.deliveryType) {
  const normalizedDeliveryType = normalizeDeliveryType(deliveryType);
  const isOfficeDelivery =
    deliveryType === "office" || deliveryType === "pickup-point";
  const explicitHubId =
    order.hubId || order.pickupPointId || order.officeId || ZR_EXPRESS_DEFAULT_HUB_ID;

  if (explicitHubId || !isOfficeDelivery) {
    return buildParcelData(order, deliveryType, explicitHubId);
  }

  const hubs = await searchDeliveryHubs();
  const hub =
    hubs.find((hub) => hub.isPickupPoint || hub.type === "stopdesk") ||
    hubs[0];

  return buildParcelData(order, deliveryType, hub?.id);
}

function sanitizeHubResponse(hub) {
  return {
    id: hub.id,
    name: hub.name,
    type: hub.type,
    isPickupPoint: hub.isPickupPoint,
    city: hub.address?.city,
    district: hub.address?.district,
  };
}

async function searchDeliveryHubs() {
  if (!isZrExpressConfigured()) {
    throw new Error("ZR Express API credentials are not configured");
  }

  const response = await zrExpressApi.post("/api/v1/hubs/search", {
    pageSize: 1000,
    includeServices: true,
  });

  return response.data?.items || [];
}

async function getDeliveryHubs() {
  const hubs = await searchDeliveryHubs();
  return hubs.map(sanitizeHubResponse);
}

function sanitizeDeliveryResponse(responseData = {}) {
  return {
    id: responseData.id || responseData.parcelId,
    trackingNumber:
      responseData.trackingNumber ||
      responseData.tracking_number ||
      responseData.id ||
      responseData.parcelId,
    status: responseData.status?.name || responseData.state?.name || responseData.status || responseData.deliveryStatus || "created",
    createdAt: responseData.createdAt || responseData.created_at,
    updatedAt: responseData.updatedAt || responseData.updated_at || responseData.lastStateUpdateAt,
  };
}

function sanitizeDeliveryError(error) {
  const response = error.response;
  if (typeof response?.data === "object" && response?.data !== null) {
    return {
      status: response.status,
      data: response.data,
    };
  }

  if (typeof response?.data === "string") {
    return {
      status: response.status,
      message: response.data.slice(0, 500),
    };
  }

  return {
    message: error.message || "Failed to communicate with ZR Express",
  };
}

async function updateOrder(storage, orderId, fields) {
  if (!storage?.updateOrder) return;
  await storage.updateOrder(orderId, fields);
}

async function findOrder(storage, orderId) {
  if (!storage?.findOrder) return null;
  return storage.findOrder(orderId);
}

async function saveDeliveryTracking(storage, orderId, trackingNumber, response = {}) {
  const deliveryStatus = "created";
  const deliveryCreatedAt = new Date().toISOString();
  const sanitizedResponse = sanitizeDeliveryResponse(response);

  await updateOrder(storage, orderId, {
    deliveryId: sanitizedResponse.id,
    deliveryTrackingNumber: trackingNumber,
    deliveryStatus,
    deliveryCreatedAt,
    deliveryUpdatedAt: deliveryCreatedAt,
    deliveryApiResponse: sanitizedResponse,
  });
}

async function saveDeliveryError(storage, orderId, error) {
  const deliveryError = sanitizeDeliveryError(error);
  const deliveryUpdatedAt = new Date().toISOString();

  await updateOrder(storage, orderId, {
    deliveryStatus: "failed",
    deliveryError,
    deliveryUpdatedAt,
  });

  return deliveryError;
}

async function createParcel(order, storage, deliveryType = order.deliveryType) {
  if (!isZrExpressConfigured()) {
    throw new Error("ZR Express API credentials are not configured");
  }

  const parcelData = await buildParcelDataAsync(order, deliveryType);
  const response = await zrExpressApi.post("/api/v1/parcels", parcelData);
  const trackingNumber =
    response.data?.trackingNumber ||
    response.data?.tracking_number ||
    response.data?.id;

  if (!trackingNumber) {
    throw new Error("ZR Express response did not include a tracking number");
  }

  await saveDeliveryTracking(storage, order.id, trackingNumber, response.data);

  return {
    trackingNumber,
    parcelData,
    response: sanitizeDeliveryResponse(response.data),
  };
}

async function createOfficeDeliveryIfNeeded(order, storage) {
  if (order.deliveryType !== "office" || !shouldAutoCreateOfficeDelivery()) {
    return null;
  }

  try {
    return {
      success: true,
      delivery: await createParcel(order, storage, "office"),
    };
  } catch (error) {
    const deliveryError = await saveDeliveryError(storage, order.id, error);
    return {
      success: false,
      error: deliveryError,
    };
  }
}

async function createDeliveryWhenReady(order, storage, deliveryType = order.deliveryType) {
  if (!order || order.deliveryTrackingNumber) {
    return null;
  }

  try {
    return {
      success: true,
      delivery: await createParcel(order, storage, deliveryType || "home"),
    };
  } catch (error) {
    const deliveryError = await saveDeliveryError(storage, order.id, error);
    return {
      success: false,
      error: deliveryError,
    };
  }
}

async function getDeliveryWilayas() {
  const response = await zrExpressApi.get("/api/v1/delivery-pricing/rates");
  return response.data;
}

async function getDeliveryRates(wilayaId) {
  const response = await getDeliveryWilayas();
  const rates = Array.isArray(response) ? response : response.rates || [];
  const wilayaRate = rates.find(
    (rate) =>
      rate.wilayaId === wilayaId ||
      rate.wilayaName?.toLowerCase() === wilayaId?.toLowerCase(),
  );

  return wilayaRate || response;
}

async function trackDelivery(order, storage) {
  if (!order?.deliveryTrackingNumber) {
    throw new Error("No delivery tracking number found");
  }

  const response = await zrExpressApi.get(
    `/api/v1/parcels/${order.deliveryTrackingNumber}`,
  );
  const sanitizedResponse = sanitizeDeliveryResponse(response.data);

  await updateOrder(storage, order.id, {
    deliveryStatus: sanitizedResponse.status,
    deliveryUpdatedAt: new Date().toISOString(),
    deliveryApiResponse: sanitizedResponse,
  });

  return sanitizedResponse;
}

async function cancelDelivery(order, storage) {
  if (!order?.deliveryTrackingNumber) {
    throw new Error("No delivery tracking number found");
  }

  let parcelId = order.deliveryId || order.deliveryApiResponse?.id;

  if (!parcelId) {
    const response = await zrExpressApi.get(
      `/api/v1/parcels/${order.deliveryTrackingNumber}`,
    );
    parcelId = response.data?.id || order.deliveryTrackingNumber;
  }

  await zrExpressApi.delete(`/api/v1/parcels/${parcelId}`);

  await updateOrder(storage, order.id, {
    deliveryStatus: "cancelled",
    deliveryCancelledAt: new Date().toISOString(),
    deliveryUpdatedAt: new Date().toISOString(),
  });

  return { success: true };
}

module.exports = {
  buildParcelData,
  buildParcelDataAsync,
  cancelDelivery,
  createDeliveryWhenReady,
  createOfficeDeliveryIfNeeded,
  createParcel,
  findOrder,
  getDeliveryHubs,
  getDeliveryRates,
  getDeliveryWilayas,
  isZrExpressConfigured,
  normalizeDeliveryType,
  saveDeliveryError,
  saveDeliveryTracking,
  shouldAutoCreateOfficeDelivery,
  trackDelivery,
};
