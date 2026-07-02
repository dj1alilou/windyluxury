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
let allTerritoriesPromise = null;

// Wilaya territory ID mapping for ZR Express (by name)
const wilayaToTerritoryId = {
  "Adrar": "6e978fc5-f20a-4b5f-9adf-61dd21a7672a",
  "Chlef": "981f136a-996f-463e-a536-8e643daab193",
  "Laghouat": "00b5ef4b-ae2e-4b7f-bd26-70c1a376b69b",
  "Oum El Bouaghi": "37c70742-df6b-4019-981a-a16a29a14748",
  "Batna": "a8c05822-e30a-4d5a-bcb3-3b3bb23c079b",
  "Bejaia": "295585ad-4cf4-4b7e-b276-9bb62d019749",
  "Biskra": "796e70df-1102-44da-9582-2da66ead2ba6",
  "Bechar": "ad2ca91e-cf67-44d3-a240-cebc19bc7c69",
  "Blida": "a7e764cf-e9ca-4c1f-8232-89852d102aec",
  "Boumerdes": "e3ed5c0e-2979-4974-adce-c5d9b4680704",
  "Tamanrasset": "bb45139d-1544-4316-bef9-46ea8a3ecf84",
  "Tebessa": "5afdfab6-e505-4691-abc7-5e8bd79afad5",
  "Tlemcen": "53c9e062-9c4e-4c77-8b71-55eabf887f83",
  "Tiaret": "ada5bb27-ffe5-4977-a917-3105c2b3d9c6",
  "Tizi Ouzou": "5bef8e95-fad8-4a15-95f0-8d6f5c80f69e",
  "Alger": "d134c182-7dac-4655-9d9b-bbdb62aa2ec4",
  "Djelfa": "65adf95c-e1a3-4c1e-a85d-f9f4c6dc6cf3",
  "Jijel": "dc851e52-55b2-4beb-a7f1-79d4e73e9458",
  "Setif": "56ee938d-7887-408e-8731-364d07ad3594",
  "Saida": "27b2042a-77f8-4c91-b62d-60934fa0daca",
  "Skikda": "a9df7e26-1086-4319-8a93-19969c99c89b",
  "Sidi Bel Abbes": "2cec2b2a-cc37-480a-9183-59fdfdb65cd4",
  "Annaba": "3fd318e8-7c24-480c-a106-21f6c842583d",
  "Guelma": "2d1e61ff-e2af-4b4d-a592-0a6436c5fffd",
  "Constantine": "e9a1e9cf-8475-4768-94cc-0888d094ff47",
  "Medea": "0e0f2d43-6d78-47dd-8bb7-0f2771cb97ff",
  "M'Sila": "75ca308d-ab36-44e2-9702-2e2300a57b8c",
  "Mascara": "a17a6482-3f48-4948-aaf2-8a653c4c1110",
  "Oran": "e772eb46-276a-4f41-bae7-3b67e1bdc616",
  "El Bayadh": "dca8b699-ce8b-4ad7-b8f2-560e63911383",
  "Bordj Bou Arreridj": "80d1b557-03b2-4073-a8c2-89a8712a7fc8",
  "El Tarf": "039daf35-c258-4ca3-9685-b769b6eb32d7",
  "Tissemsilt": "fb1a9f7a-81a2-4825-af92-79f9d187637f",
  "El Oued": "cd82549a-b1f7-48c1-9a25-2f3f05b80b1d",
  "Khenchela": "d4549528-8327-4a3f-9732-5a5462c84b8d",
  "Souk Ahras": "56d30b7a-465a-462c-bc2a-3e132c89be63",
  "Mila": "0c8476c5-bbe4-46e4-80e5-67d3501195cc",
  "Ain Defla": "8d2d130f-460c-4867-85ef-641341a4d586",
  "Naama": "ecdf0888-0470-4b2f-beb8-24c99b6fc9cb",
  "Ghardaia": "e7b51620-74f4-4748-85c5-216fb9b01b03",
  "Relizane": "ad58c5ee-868d-4acb-8f03-409f97a10370",
};

// Default commune ID for Blida wilaya (used as fallback)
// This is a valid commune within Blida wilaya - Oued El Alleug
const DEFAULT_COMMUNE_ID = "ed9c7e3d-c24b-4098-b904-88005082563d";

// Wilaya name mapping to ZR Express format
const wilayaNameMap = {
  "Médéa": "Medea",
  "El Bayadh": "El Bayadh", // Already correct
  "Sidi Bel Abbès": "Sidi Bel Abbes",
  "Aïn Defla": "Ain Defla",
  "Béjaïa": "Bejaia",
  "Béchar": "Bechar",
  "Bouïra": "Blida", // Blida as Bouira not in ZR
  "Tébessa": "Tebessa",
  "Saïda": "Saida",
  "M'Sila": "MSila",
  "Bordj Bou Arréridj": "Bordj Bou Arreridj",
  "Boumerdès": "Boumerdes",
  "Ghardaïa": "Ghardaia",
  "Timimoun": "Touggourt",
  "Bordj Badji Mokhtar": "Touggourt",
  "Ouled Djellal": "Biskra",
  "Béni Abbès": "Beni Abbes",
  "El M'Ghair": "El Oued",
  "Meniaa": "MSila",
  "Mostaganem": "Oran",
  "Alger": "Alger",
};

function normalizeWilayaName(wilaya) {
  if (!wilaya) return wilaya;
  const trimmed = wilaya.trim();
  // Try exact match first
  if (wilayaNameMap[trimmed]) return wilayaNameMap[trimmed];
  // Try case-insensitive match
  const lower = trimmed.toLowerCase();
  for (const [key, value] of Object.entries(wilayaNameMap)) {
    if (key.toLowerCase() === lower) return value;
  }
  return trimmed;
}

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

function normalizeLookupText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function compactLookupText(value) {
  return normalizeLookupText(value).replace(/[^\p{L}\p{N}\u0600-\u06FF]/gu, "");
}

function getInitials(value) {
  const tokens = normalizeLookupText(value).split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  return tokens.map((token) => token[0]).join("");
}

function territoryMatchesInitials(territory, value) {
  const initials = getInitials(value);

  return initials.length >= 3 && getInitials(territory.name) === initials;
}

function getTerritorySearchKeywords(...values) {
  const keywords = [];

  for (const value of values) {
    if (!value) continue;

    const raw = String(value).trim();
    const lookup = normalizeLookupText(raw);
    const compact = compactLookupText(raw);

    keywords.push(raw, lookup, compact);
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

async function searchTerritoriesByKeyword(keyword, pageNumber = 1, pageSize = 1000) {
  if (!isZrExpressConfigured()) {
    throw new Error("ZR Express API credentials are not configured");
  }

  const requestBody = {
    pageNumber,
    pageSize,
  };

  if (keyword) {
    requestBody.keyword = keyword;
    requestBody.advancedSearch = {
      fields: ["name", "code"],
      keyword,
    };
  } else {
    requestBody.keyword = "";
  }

  const response = await zrExpressApi.post(
    "/api/v1/territories/search",
    requestBody,
  );

  return getApiItems(response.data);
}

async function getAllTerritories() {
  if (!isZrExpressConfigured()) return [];
  if (allTerritoriesPromise) return allTerritoriesPromise;

  allTerritoriesPromise = (async () => {
    try {
      const territories = [];
      let pageNumber = 1;
      let totalPages = 1;

      do {
        const response = await zrExpressApi.post("/api/v1/territories/search", {
          pageNumber,
          pageSize: 1000,
          keyword: "",
        });
        const pageItems = getApiItems(response.data);
        territories.push(...pageItems);
        totalPages = response.data?.totalPages || 1;
        pageNumber += 1;
      } while (pageNumber <= totalPages && pageNumber <= 5);

      return territories;
    } catch (error) {
      allTerritoriesPromise = null;
      console.error("Error fetching ZR territories:", error.response?.data || error.message);
      return [];
    }
  })();

  return allTerritoriesPromise;
}

function territoryMatchesName(territory, value) {
  const territoryName = normalizeLookupText(territory.name);
  const lookupValue = normalizeLookupText(value);

  return (
    territoryName === lookupValue ||
    compactLookupText(territoryName) === compactLookupText(lookupValue) ||
    territoryMatchesInitials(territory, value)
  );
}

function territoryMatchesLooseName(territory, value) {
  return territoryMatchesName(territory, value) || territoryMatchesFuzzy(territory, value);
}

function territoryMatchesCode(territory, value) {
  return (
    normalizeLookupText(territory.code) === normalizeLookupText(value) ||
    String(territory.code) === String(value).trim()
  );
}

function levenshteinDistance(a, b) {
  const left = compactLookupText(a);
  const right = compactLookupText(b);

  if (!left || !right) return Number.MAX_SAFE_INTEGER;
  if (left === right) return 0;

  const costs = Array.from({ length: right.length + 1 }, (_, index) => index);

  for (let i = 1; i <= left.length; i += 1) {
    let previous = costs[0];
    costs[0] = i;

    for (let j = 1; j <= right.length; j += 1) {
      const current = costs[j];
      const substitutionCost = left[i - 1] === right[j - 1] ? 0 : 1;
      costs[j] = Math.min(
        costs[j] + 1,
        costs[j - 1] + 1,
        previous + substitutionCost,
      );
      previous = current;
    }
  }

  return costs[right.length];
}

function territoryMatchesFuzzy(territory, value) {
  const territoryName = compactLookupText(territory.name);
  const lookupValue = compactLookupText(value);

  if (!territoryName || !lookupValue) return false;
  if (territoryName.includes(lookupValue) || lookupValue.includes(territoryName)) {
    return true;
  }

  const distance = levenshteinDistance(territoryName, lookupValue);
  const maxLength = Math.max(territoryName.length, lookupValue.length);

  return maxLength >= 4 && distance <= Math.max(2, Math.floor(maxLength * 0.25));
}

function territoryLevelMatches(territory, level) {
  return normalizeLookupText(territory.level) === normalizeLookupText(level);
}

function findTerritoryInList(territories, keywords, level, parentId) {
  for (const keyword of keywords) {
    const exactMatch = territories.find(
      (territory) =>
        territoryLevelMatches(territory, level) &&
        (parentId === undefined || territory.parentId === parentId) &&
        (territoryMatchesName(territory, keyword) ||
          territoryMatchesCode(territory, keyword)),
    );

    if (exactMatch) return exactMatch;
  }

  if (level === "commune") {
    for (const keyword of keywords) {
      const fuzzyMatch = territories.find(
        (territory) =>
          territoryLevelMatches(territory, level) &&
          (parentId === undefined || territory.parentId === parentId) &&
          territoryMatchesLooseName(territory, keyword),
      );

      if (fuzzyMatch) return fuzzyMatch;
    }

    return territories.find(
      (territory) =>
        territoryLevelMatches(territory, level) &&
        (parentId === undefined || territory.parentId === parentId),
    );
  }

  return undefined;
}

async function findTerritoryByLevel(keywords, level, parentId) {
  if (!keywords.length) return undefined;

  const territories = await getAllTerritories();
  const cachedMatch = findTerritoryInList(territories, keywords, level, parentId);

  if (cachedMatch) return cachedMatch;

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

async function resolveDeliveryTerritoryIds(order) {
  if (isUuid(order.cityTerritoryId) && isUuid(order.districtTerritoryId)) {
    return {
      cityTerritoryId: order.cityTerritoryId,
      districtTerritoryId: order.districtTerritoryId,
    };
  }

  if (!isZrExpressConfigured()) {
    console.log("ZR Express not configured, returning empty territory IDs");
    return {};
  }

  try {
    const territories = await getAllTerritories();
    if (!territories || territories.length === 0) {
      console.log("No territories found from ZR Express API");
      return {};
    }
    
    console.log("Territories loaded:", territories.length, "Searching for wilaya:", order.wilaya, "commune:", order.commune);

    const normalizedWilaya = normalizeWilayaName(order.wilaya);
    
    // Try to match wilaya by code if it's a number
    let wilayaTerritory = null;
    if (order.wilayaId && !isUuid(order.wilayaId)) {
      wilayaTerritory = territories.find(
        (t) => t.level === 'wilaya' && String(t.code) === String(order.wilayaId)
      );
      console.log("Matched wilaya by code:", order.wilayaId, wilayaTerritory ? wilayaTerritory.name : "not found");
    }
    
    const wilayaKeywords = getTerritorySearchKeywords(normalizedWilaya, order.wilayaId);
    const districtKeywords = getTerritorySearchKeywords(
      order.commune,
      order.communeId,
      order.districtTerritoryId,
      normalizedWilaya,
      order.wilayaId,
    );

    if (isUuid(order.cityTerritoryId) && territories.length > 0) {
      const cityTerritory = territories.find((territory) => territory.id === order.cityTerritoryId);
      const districtTerritory =
        findTerritoryInList(territories, districtKeywords, "commune", cityTerritory?.id) ||
        (isUuid(order.districtTerritoryId)
          ? territories.find((territory) => territory.id === order.districtTerritoryId)
          : undefined);

      return {
        cityTerritoryId: cityTerritory?.id || order.cityTerritoryId,
        districtTerritoryId:
          districtTerritory?.id || (isUuid(order.districtTerritoryId) ? order.districtTerritoryId : DEFAULT_COMMUNE_ID),
      };
    }

    if (wilayaTerritory) {
      const districtTerritory =
        findTerritoryInList(territories, districtKeywords, "commune", wilayaTerritory.id) ||
        (isUuid(order.districtTerritoryId)
          ? territories.find((territory) => territory.id === order.districtTerritoryId)
          : undefined);

      return {
        cityTerritoryId: wilayaTerritory.id,
        districtTerritoryId:
          districtTerritory?.id || DEFAULT_COMMUNE_ID,
      };
    }

    const wilaya = await findTerritoryByLevel(wilayaKeywords, "wilaya");

    if (!wilaya) {
      console.log("Wilaya not found in territories, tried:", order.wilaya, "normalized:", normalizedWilaya);
      const territoryId = wilayaToTerritoryId[normalizedWilaya];
      if (territoryId) {
        console.log("Using fallback territory ID for wilaya:", normalizedWilaya, territoryId);
        return {
          cityTerritoryId: territoryId,
          districtTerritoryId: DEFAULT_COMMUNE_ID,
        };
      }
      const fallbackId = wilayaToTerritoryId["Blida"] || "a7e764cf-e9ca-4c1f-8232-89852d102aec";
      console.log("Using Blida fallback for unknown wilaya:", normalizedWilaya);
      return {
        cityTerritoryId: fallbackId,
        districtTerritoryId: DEFAULT_COMMUNE_ID,
      };
    }

    const district = await findTerritoryByLevel(districtKeywords, "commune", wilaya.id);

    return {
      cityTerritoryId: wilaya.id,
      districtTerritoryId: district?.id || DEFAULT_COMMUNE_ID,
    };
  } catch (error) {
    console.error("Error resolving territory IDs:", error.message);
    // Return Blida with a default commune as fallback
    return {
      cityTerritoryId: wilayaToTerritoryId["Blida"] || "a7e764cf-e9ca-4c1f-8232-89852d102aec",
      districtTerritoryId: DEFAULT_COMMUNE_ID,
    };
  }
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
      undefined,
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
    const hubs = await searchDeliveryHubs();
    const hubExists = hubs.some((hub) => hub.id === explicitHubId);

    if (!hubExists) {
      const hub = findPickupHubForOrder(hubs, order);
      return buildParcelData(
        order,
        deliveryType,
        hub?.id,
        territoryIds,
        stateId,
        options,
      );
    }

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
    errors.push("deliveryAddress.cityTerritoryId (REQUIRED - wilaya territory ID)");
  }
  if (!parcelData.deliveryAddress?.districtTerritoryId) {
    errors.push("deliveryAddress.districtTerritoryId (REQUIRED - commune territory ID)");
  }
  if (parcelData.deliveryType === "pickup-point" && !parcelData.hubId) {
    errors.push("hubId (required for pickup-point delivery)");
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

  const retryOptions = { ignoreStateId: true };
  let parcelData = await buildParcelDataAsync(order, deliveryType, retryOptions);
  validateParcelData(parcelData);

  let response;

  try {
    console.log("Creating parcel with data:", JSON.stringify(parcelData, null, 2));
    response = await zrExpressApi.post("/api/v1/parcels", parcelData);
  } catch (error) {
    console.error("First parcel attempt failed:", getZrExpressErrorText(error));
    
    const shouldRetry = shouldRetryParcelWithStockProducts(error);
    if (shouldRetry) {
      const stockOptions = { ...retryOptions, forceStockProducts: true };
      parcelData = await buildParcelDataAsync(order, deliveryType, stockOptions);
      validateParcelData(parcelData);
      response = await zrExpressApi.post("/api/v1/parcels", parcelData);
    } else {
      throw error;
    }
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
