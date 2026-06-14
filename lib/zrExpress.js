const axios = require("axios");
const { randomUUID } = require("crypto");

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

function normalizePhone(phone) {
  if (!phone) return undefined;
  const value = String(phone).trim();
  if (value.startsWith("+213")) return value;
  if (value.startsWith("00213")) return `+${value.slice(2)}`;
  if (value.startsWith("0") && value.length === 10) return `+213${value.slice(1)}`;
  return value;
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function getProducts(order) {
  const products = order.products || order.items || [];
  if (Array.isArray(products)) return products;
  if (typeof products === "object" && products !== null) {
    return Object.values(products);
  }
  return [];
}

function buildDeliveryAddress(order, territoryIds = {}) {
  const isOfficeDelivery =
    order.deliveryType === "office" || order.deliveryType === "pickup-point";
  const officeName = order.officeName || order.office || order.deliveryOffice || "";
  const fallbackAddress = [order.address, order.commune, order.wilaya]
    .filter(Boolean)
    .join(", ");
  const address = isOfficeDelivery
    ? order.officeAddress || officeName || fallbackAddress
    : order.address || order.deliveryAddress || fallbackAddress;

  return {
    street: address,
    cityTerritoryId:
      territoryIds.cityTerritoryId ||
      (isUuid(order.cityTerritoryId) ? order.cityTerritoryId : undefined),
    districtTerritoryId:
      territoryIds.districtTerritoryId ||
      (isUuid(order.districtTerritoryId) ? order.districtTerritoryId : undefined),
  };
}

function buildDeliveryAddressWithDeliveryType(order, deliveryType, territoryIds = {}) {
  return buildDeliveryAddress(
    { ...order, deliveryType: deliveryType || order.deliveryType },
    territoryIds,
  );
}

function buildOrderedProducts(order) {
  return getProducts(order).map((product) => ({
    productName: product.title || product.name || "Produit",
    productSku: product.sku || product.id || "",
    quantity: product.quantity || 1,
    unitPrice: Number(product.price || product.unitPrice || 0),
    stockType: "none",
  }));
}

function getOrderAmount(order) {
  const products = getProducts(order);
  const productTotal = products.reduce(
    (sum, product) =>
      sum + Number(product.price || product.unitPrice || 0) * Number(product.quantity || 1),
    0,
  );

  return Number(
    order.total ||
      order.amount ||
      order.subtotal ||
      productTotal + Number(order.deliveryPrice || 0) ||
      productTotal ||
      0,
  );
}

function buildParcelData(order, deliveryType = order.deliveryType, hubId, territoryIds = {}) {
  const normalizedDeliveryType = normalizeDeliveryType(deliveryType);
  const isOfficeDelivery =
    deliveryType === "office" || deliveryType === "pickup-point";
  const resolvedHubId =
    hubId ??
    (order.hubId ||
      order.pickupPointId ||
      order.officeId ||
      (isOfficeDelivery ? ZR_EXPRESS_DEFAULT_HUB_ID : undefined));

  return {
    customer: {
      customerId: randomUUID(),
      name: order.customerName,
      phone: {
        number1: normalizePhone(order.customerPhone),
        number2: normalizePhone(order.customerPhone2) || "",
        number3: normalizePhone(order.customerPhone3) || "",
      },
    },
    deliveryAddress: buildDeliveryAddressWithDeliveryType(
      order,
      deliveryType,
      territoryIds,
    ),
    hubId: resolvedHubId,
    orderedProducts: buildOrderedProducts(order),
    deliveryType: normalizedDeliveryType,
    description: order.notes || order.description || "Commande windy.luxury",
    externalId: String(order.id),
    stateId: order.stateId || undefined,
    amount: getOrderAmount(order),
  };
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

async function searchTerritoriesByKeyword(keyword) {
  if (!isZrExpressConfigured()) {
    throw new Error("ZR Express API credentials are not configured");
  }

  if (!keyword) return [];

  const response = await zrExpressApi.post("/api/v1/territories/search", {
    pageNumber: 1,
    pageSize: 1000,
    keyword,
    advancedSearch: {
      fields: ["name", "code"],
      keyword,
    },
  });

  return response.data?.items || [];
}

function territoryMatchesName(territory, value) {
  return normalizeText(territory.name) === normalizeText(value);
}

function territoryMatchesCode(territory, value) {
  return normalizeText(territory.code) === normalizeText(value);
}

function territoryLevelMatches(territory, level) {
  return normalizeText(territory.level) === normalizeText(level);
}

async function resolveDeliveryTerritoryIds(order) {
  if (isUuid(order.cityTerritoryId) && isUuid(order.districtTerritoryId)) {
    return {
      cityTerritoryId: order.cityTerritoryId,
      districtTerritoryId: order.districtTerritoryId,
    };
  }

  if (!isZrExpressConfigured()) {
    return {};
  }

  const wilayaKeyword = order.wilaya || order.wilayaId;
  const wilayaResults = await searchTerritoriesByKeyword(wilayaKeyword);
  const wilaya = wilayaResults.find(
    (territory) =>
      territoryLevelMatches(territory, "wilaya") &&
      (territoryMatchesName(territory, order.wilaya) ||
        territoryMatchesCode(territory, order.wilayaId)),
  );

  if (!wilaya) return {};

  const districtResults = await searchTerritoriesByKeyword(order.commune);
  const district =
    districtResults.find(
      (territory) =>
        territoryLevelMatches(territory, "commune") &&
        territory.parentId === wilaya.id &&
        territoryMatchesName(territory, order.commune),
    ) ||
    districtResults.find(
      (territory) =>
        territoryLevelMatches(territory, "commune") &&
        territoryMatchesName(territory, order.commune),
    );

  return {
    cityTerritoryId: wilaya.id,
    districtTerritoryId: district?.id,
  };
}

async function buildParcelDataAsync(order, deliveryType = order.deliveryType) {
  const isOfficeDelivery =
    deliveryType === "office" || deliveryType === "pickup-point";
  const explicitHubId =
    order.hubId || order.pickupPointId || order.officeId || ZR_EXPRESS_DEFAULT_HUB_ID;
  const territoryIds = await resolveDeliveryTerritoryIds(order);

  if (!isOfficeDelivery) {
    return buildParcelData(order, deliveryType, explicitHubId, territoryIds);
  }

  if (!isZrExpressConfigured()) {
    return buildParcelData(order, deliveryType, explicitHubId, territoryIds);
  }

  if (explicitHubId) {
    return buildParcelData(order, deliveryType, explicitHubId, territoryIds);
  }

  const hubs = await searchDeliveryHubs();
  const hub =
    hubs.find((hub) => hub.isPickupPoint || hub.type === "stopdesk") ||
    hubs[0];

  return buildParcelData(order, deliveryType, hub?.id, territoryIds);
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

function validateParcelData(parcelData) {
  const errors = [];

  if (!parcelData.customer?.customerId) errors.push("customer.customerId");
  if (!parcelData.customer?.name) errors.push("customer.name");
  if (!parcelData.customer?.phone?.number1) errors.push("customer.phone.number1");
  if (!parcelData.deliveryAddress?.cityTerritoryId) {
    errors.push("deliveryAddress.cityTerritoryId");
  }
  if (!parcelData.deliveryAddress?.districtTerritoryId) {
    errors.push("deliveryAddress.districtTerritoryId");
  }
  if (parcelData.deliveryType === "pickup-point" && !parcelData.hubId) {
    errors.push("hubId");
  }
  if (!Array.isArray(parcelData.orderedProducts) || parcelData.orderedProducts.length === 0) {
    errors.push("orderedProducts");
  }
  if (!parcelData.description) errors.push("description");
  if (!parcelData.amount) errors.push("amount");

  if (errors.length > 0) {
    throw new Error(`Invalid ZR Express parcel payload: missing ${errors.join(", ")}`);
  }
}

async function createParcel(order, storage, deliveryType = order.deliveryType) {
  if (!isZrExpressConfigured()) {
    throw new Error("ZR Express API credentials are not configured");
  }

  const parcelData = await buildParcelDataAsync(order, deliveryType);
  validateParcelData(parcelData);
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
