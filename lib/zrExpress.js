const axios = require("axios");
const { randomUUID } = require("crypto");

const ZR_EXPRESS_API_KEY = process.env.ZR_EXPRESS_API_KEY;
const ZR_EXPRESS_TENANT_ID = process.env.ZR_EXPRESS_TENANT_ID;
const ZR_EXPRESS_DEFAULT_HUB_ID = process.env.ZR_EXPRESS_DEFAULT_HUB_ID;
const ZR_EXPRESS_READY_STATE_ID = process.env.ZR_EXPRESS_READY_STATE_ID;
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

let readyStateIdPromise = null;

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
  const value = String(phone).replace(/\s+/g, "").trim();
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

function getTerritorySearchKeywords(...values) {
  const keywords = [];

  for (const value of values) {
    if (!value) continue;

    const raw = String(value).trim();
    const deaccented = raw
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();

    keywords.push(raw, deaccented, normalizeText(raw));
  }

  return Array.from(new Set(keywords.filter(Boolean)));
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function truncateText(value, maxLength) {
  const text = String(value || "").trim();
  return text.length > maxLength ? `${text.slice(0, maxLength - 3)}...` : text;
}

function getCustomerName(order) {
  return truncateText(order.customerName || "Client", 100) || "Client";
}

function getApiItems(responseData = {}) {
  if (Array.isArray(responseData)) return responseData;
  return (
    responseData?.items ||
    responseData?.data?.items ||
    responseData?.result?.items ||
    []
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
  const deliveryAddress =
    typeof order.deliveryAddress === "object" && order.deliveryAddress !== null
      ? order.deliveryAddress
      : null;
  const address = isOfficeDelivery
    ? order.officeAddress ||
      deliveryAddress?.street ||
      officeName ||
      fallbackAddress
    : order.address ||
      deliveryAddress?.street ||
      order.deliveryAddress ||
      fallbackAddress;

  return {
    street: address,
    cityTerritoryId:
      territoryIds.cityTerritoryId ||
      (isUuid(order.cityTerritoryId) ? order.cityTerritoryId : undefined) ||
      (isUuid(order.wilayaId) ? order.wilayaId : undefined),
    districtTerritoryId:
      territoryIds.districtTerritoryId ||
      (isUuid(order.districtTerritoryId) ? order.districtTerritoryId : undefined) ||
      (isUuid(order.communeId) ? order.communeId : undefined),
  };
}

function buildDeliveryAddressWithDeliveryType(order, deliveryType, territoryIds = {}) {
  return buildDeliveryAddress(
    { ...order, deliveryType: deliveryType || order.deliveryType },
    territoryIds,
  );
}

function buildOrderedProducts(order, forceStockProducts = false) {
  return getProducts(order).map((product) => ({
    productId: forceStockProducts ? randomUUID() : undefined,
    productName: product.title || product.name || "Produit",
    productSku: product.sku || product.id || "",
    quantity: Number(product.quantity) || 1,
    unitPrice: Number(product.price || product.unitPrice || 1),
    stockType: forceStockProducts ? "local" : "none",
  }));
}

function getOrderAmount(order) {
  const products = getProducts(order);
  const productTotal = products.reduce(
    (sum, product) =>
      sum + Number(product.price || product.unitPrice || 0) * Number(product.quantity || 1),
    0,
  );

  const amount = Number(
    order.total ||
      order.amount ||
      order.subtotal ||
      productTotal + Number(order.deliveryPrice || 0) ||
      productTotal ||
      1,
  );

  return Math.min(amount || 1, 150000);
}

function buildParcelData(
  order,
  deliveryType = order.deliveryType,
  hubId,
  territoryIds = {},
  stateId,
  options = {},
) {
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
      name: getCustomerName(order),
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
    orderedProducts: buildOrderedProducts(order, options.forceStockProducts),
    deliveryType: normalizedDeliveryType,
    description:
      truncateText(order.notes || order.description || "Commande windy.luxury", 250) ||
      "Commande windy.luxury",
    externalId: String(order.id).slice(0, 100),
    stateId: (isUuid(stateId) || isUuid(order.stateId)) ? (stateId || order.stateId) : undefined,
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

  return getApiItems(response.data);
}

async function getDeliveryHubs() {
  const hubs = await searchDeliveryHubs();
  return hubs.map(sanitizeHubResponse);
}

function hubMatchesOrder(hub, order) {
  const orderWilaya = normalizeText(order.wilaya);
  const hubCity = normalizeText(hub.city || hub.address?.city || hub.name);
  const hubName = normalizeText(hub.name);

  return (
    (orderWilaya && (hubCity === orderWilaya || hubName.includes(orderWilaya))) ||
    (order.commune && hubName.includes(normalizeText(order.commune)))
  );
}

function findPickupHubForOrder(hubs, order) {
  return (
    hubs.find((hub) => hubMatchesOrder(hub, order) && (hub.isPickupPoint || hub.type === "stopdesk")) ||
    hubs.find((hub) => hub.isPickupPoint || hub.type === "stopdesk") ||
    hubs[0]
  );
}

async function searchTerritoriesByKeyword(keyword) {
  if (!isZrExpressConfigured()) {
    throw new Error("ZR Express API credentials are not configured");
  }

  if (!keyword) return [];

  const requestBody = {
    pageNumber: 1,
    pageSize: 1000,
  };

  if (keyword) {
    requestBody.keyword = keyword;
    requestBody.advancedSearch = {
      fields: ["name", "code"],
      keyword,
    };
  }

  const response = await zrExpressApi.post(
    "/api/v1/territories/search",
    requestBody,
  );

  return getApiItems(response.data);
}

async function findTerritoryByLevel(keywords, level, parentId) {
  for (const keyword of keywords) {
    const results = await searchTerritoriesByKeyword(keyword);
    const exactMatch = results.find(
      (territory) =>
        territoryLevelMatches(territory, level) &&
        (parentId === undefined || territory.parentId === parentId) &&
        (territoryMatchesName(territory, keyword) ||
          territoryMatchesCode(territory, keyword)),
    );

    if (exactMatch) return exactMatch;

    const firstMatch = results.find(
      (territory) =>
        territoryLevelMatches(territory, level) &&
        (parentId === undefined || territory.parentId === parentId),
    );

    if (firstMatch) return firstMatch;
  }

  return undefined;
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

  if (isUuid(order.wilayaId) && !isUuid(order.cityTerritoryId)) {
    const districtTerritoryId =
      isUuid(order.districtTerritoryId) || isUuid(order.communeId)
        ? order.districtTerritoryId || order.communeId
        : order.commune && isZrExpressConfigured()
          ? (await findTerritoryByLevel(
              getTerritorySearchKeywords(order.commune, order.communeId),
              "commune",
              order.wilayaId,
            ))?.id
          : undefined;

    return {
      cityTerritoryId: order.wilayaId,
      districtTerritoryId,
    };
  }

  if (!isZrExpressConfigured()) {
    return {};
  }

  const wilaya = await findTerritoryByLevel(
    getTerritorySearchKeywords(order.wilaya, order.wilayaId),
    "wilaya",
  );

  if (!wilaya) return {};

  const district = await findTerritoryByLevel(
    getTerritorySearchKeywords(order.commune, order.communeId, order.districtTerritoryId),
    "commune",
    wilaya.id,
  );

  return {
    cityTerritoryId: wilaya.id,
    districtTerritoryId: district?.id,
  };
}

async function searchWorkflows() {
  const response = await zrExpressApi.post("/api/v1/workflows/search", {
    pageNumber: 1,
    pageSize: 100,
  });

  return getApiItems(response.data);
}

function normalizeStateText(value) {
  return normalizeText(value)
    .replace(/[_-]/g, " ")
    .replace(/\s+/g, " ");
}

function isReadyToShipState(state) {
  const text = normalizeStateText(`${state.slug || ""} ${state.name || ""}`);
  return (
    text.includes("pret a expedier") ||
    text.includes("prêt à expedier") ||
    text.includes("pret a expédier") ||
    text.includes("ready") ||
    text.includes("expedier") ||
    text.includes("expédier")
  );
}

async function resolveReadyStateId() {
  if (ZR_EXPRESS_READY_STATE_ID) return ZR_EXPRESS_READY_STATE_ID;
  if (!isZrExpressConfigured()) return undefined;
  if (readyStateIdPromise) return readyStateIdPromise;

  readyStateIdPromise = searchWorkflows()
    .then((workflows) => {
      const workflow = workflows.find((item) => item.isDefault) || workflows[0];
      const states = workflow?.states || [];
      const readyState =
        states.find(isReadyToShipState) ||
        states.find((state) => normalizeText(state.name).includes("pret")) ||
        states[0];

      return readyState?.id;
    })
    .catch(() => undefined);

  return readyStateIdPromise;
}

async function buildParcelDataAsync(
  order,
  deliveryType = order.deliveryType,
  options = {},
) {
  const isOfficeDelivery =
    deliveryType === "office" || deliveryType === "pickup-point";
  const explicitHubId =
    order.hubId || order.pickupPointId || order.officeId || ZR_EXPRESS_DEFAULT_HUB_ID;
  const territoryIds = await resolveDeliveryTerritoryIds(order);
  const stateId = options.ignoreStateId ? undefined : await resolveReadyStateId();

  if (!isOfficeDelivery) {
    return buildParcelData(
      order,
      deliveryType,
      explicitHubId,
      territoryIds,
      stateId,
      options,
    );
  }

  if (!isZrExpressConfigured()) {
    return buildParcelData(
      order,
      deliveryType,
      explicitHubId,
      territoryIds,
      stateId,
      options,
    );
  }

  if (explicitHubId) {
    return buildParcelData(
      order,
      deliveryType,
      explicitHubId,
      territoryIds,
      stateId,
      options,
    );
  }

  const hubs = await searchDeliveryHubs();
  const hub = findPickupHubForOrder(hubs, order);

  return buildParcelData(order, deliveryType, hub?.id, territoryIds, stateId, options);
}

function sanitizeDeliveryResponse(responseData = {}) {
  const data = responseData?.data || responseData?.result || responseData;
  return {
    id: data.id || data.parcelId,
    trackingNumber:
      data.trackingNumber ||
      data.tracking_number ||
      data.id ||
      data.parcelId,
    status: data.status?.name || data.state?.name || data.status || data.deliveryStatus || "created",
    createdAt: data.createdAt || data.created_at,
    updatedAt: data.updatedAt || data.updated_at || data.lastStateUpdateAt,
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

  try {
    await updateOrder(storage, orderId, {
      deliveryId: sanitizedResponse.id,
      deliveryTrackingNumber: trackingNumber,
      deliveryStatus,
      deliveryCreatedAt,
      deliveryUpdatedAt: deliveryCreatedAt,
      deliveryApiResponse: sanitizedResponse,
    });
  } catch (error) {
    console.error("Error saving delivery tracking:", error.message);
  }
}

async function saveDeliveryError(storage, orderId, error) {
  const deliveryError = sanitizeDeliveryError(error);
  const deliveryUpdatedAt = new Date().toISOString();

  try {
    await updateOrder(storage, orderId, {
      deliveryStatus: "failed",
      deliveryError,
      deliveryUpdatedAt,
    });
  } catch (error) {
    console.error("Error saving delivery error:", error.message);
  }

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

function getZrExpressErrorText(error) {
  const data = error.response?.data;
  if (typeof data === "object" && data !== null) {
    if (Array.isArray(data.errors)) {
      return data.errors
        .map((item) => item.description || item.message || JSON.stringify(item))
        .join("; ");
    }

    return data.detail || data.message || data.error || JSON.stringify(data);
  }

  if (typeof data === "string") return data;
  return error.message || "Failed to communicate with ZR Express";
}

function shouldRetryParcelWithStockProducts(error) {
  const text = getZrExpressErrorText(error).toLowerCase();
  return (
    text.includes("productid") ||
    text.includes("product id") ||
    text.includes("stocktype") ||
    text.includes("stock type") ||
    text.includes("products must")
  );
}

async function createParcel(order, storage, deliveryType = order.deliveryType) {
  if (!isZrExpressConfigured()) {
    throw new Error("ZR Express API credentials are not configured");
  }

  let parcelData = await buildParcelDataAsync(order, deliveryType);
  validateParcelData(parcelData);

  let response;

  try {
    response = await zrExpressApi.post("/api/v1/parcels", parcelData);
  } catch (error) {
    const retryOptions = {
      ignoreStateId: true,
      forceStockProducts: shouldRetryParcelWithStockProducts(error),
    };

    if (!retryOptions.ignoreStateId && !retryOptions.forceStockProducts) {
      throw error;
    }

    parcelData = await buildParcelDataAsync(order, deliveryType, retryOptions);
    validateParcelData(parcelData);
    response = await zrExpressApi.post("/api/v1/parcels", parcelData);
  }

  const responseData = response.data?.data || response.data?.result || response.data;
  const trackingNumber =
    responseData?.trackingNumber ||
    responseData?.tracking_number ||
    responseData?.id;

  if (!trackingNumber) {
    throw new Error("ZR Express response did not include a tracking number");
  }

  await saveDeliveryTracking(storage, order.id, trackingNumber, responseData);

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
