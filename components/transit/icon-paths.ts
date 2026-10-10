// 統一命名、集中管理的圖示路徑清單。相同概念（例如火車圖示）在不同檔案都指向同一個路徑字串，
// 之後只要把檔案放到對應路徑，所有用到的地方會一次全部換成真圖，不用逐一改程式碼。
// 檔案還沒上傳前，ImageSlot／IconImg 會自動用漸層佔位顯示，圖片 404 也不會壞掉。
export const ICON_PATHS = {
  // 首頁最上方的大張插畫 Banner，使用者在「其他」頁編輯時從這幾張裡挑一張，key 跟
  // components/transit/caption-image-options.ts 的 HERO_BANNER_IMAGE_OPTIONS 對應。
  heroMainThink: "/transit/main-think.png",
  heroMainWork: "/transit/main-work.png",
  heroMainPlaygame: "/transit/main-playgame.png",
  // 完全沒設定過任何一組時，畫面退回的預設圖，用第一張代表。
  heroMain: "/transit/main-think.png",

  // 首頁「週末小旅行」區塊可選的背景圖（整個卡片背景，不是小圖示），key 跟
  // components/transit/caption-image-options.ts 的 WEEKEND_TRIP_IMAGE_OPTIONS 對應。
  weekendTripBannerGetup: "/transit/banner-getup.png",
  weekendTripBannerTired: "/transit/banner-tired.png",
  // 完全沒設定過任何一組時，畫面退回的預設圖，用第一張代表。
  weekendTripBanner: "/transit/banner-getup.png",

  navHome: "/transit/nav-home.png",
  navTrips: "/transit/nav-trips.png",
  navYoubike: "/transit/nav-youbike.png",
  navOther: "/transit/nav-other.png",

  modeTrain: "/transit/mode-train.png",
  modeThsr: "/transit/mode-thsr.png",
  modeBus: "/transit/mode-bus.png",
  modeMetro: "/transit/mode-metro.png",

  weatherSunny: "/transit/weather-sunny.png",
  weatherCloudy: "/transit/weather-cloudy.png",
  weatherRain: "/transit/weather-rain.png",

  // 備忘錄可選的圖示，key 跟 components/transit/memo-icons.ts 的 MEMO_ICON_OPTIONS 對應。
  memoDrinks: "/transit/memo-drinks.png",
  memoTicket: "/transit/memo-ticket.png",
  memoWork: "/transit/memo-work.png",
  memoShop: "/transit/memo-shop.png",
  memoBill: "/transit/memo-bill.png",
  memoTime: "/transit/memo-time.png",
  memoMap: "/transit/memo-map.png",
  memoMeal: "/transit/memo-meal.png",

  // 常用行程可選的圖示，key 跟 components/transit/frequent-trip-icons.ts 的
  // FREQUENT_TRIP_ICON_OPTIONS 對應。
  tripOutbound: "/transit/trip-outbound.png",
  tripInbound: "/transit/trip-inbound.png",
  tripGoout: "/transit/trip-goout.png",
} as const;
