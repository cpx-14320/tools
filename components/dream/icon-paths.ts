// 統一命名、集中管理的圖示路徑清單。相同概念（例如火車圖示）在不同檔案都指向同一個路徑字串，
// 之後只要把檔案放到對應路徑，所有用到的地方會一次全部換成真圖，不用逐一改程式碼。
// 檔案還沒上傳前，ImageSlot／IconImg 會自動用漸層佔位顯示，圖片 404 也不會壞掉。
export const ICON_PATHS = {
  // 首頁最上方的大張插畫 Banner，使用者在「其他」頁編輯時從這幾張裡挑一張，key 跟
  // components/dream/caption-image-options.ts 的 HERO_BANNER_IMAGE_OPTIONS 對應。
  heroMainThink: "/icons/dream/main-think.png",
  heroMainWork: "/icons/dream/main-work.png",
  heroMainPlaygame: "/icons/dream/main-playgame.png",
  // 完全沒設定過任何一組時，畫面退回的預設圖，用第一張代表。
  heroMain: "/icons/dream/main-think.png",

  // 首頁「週末小旅行」區塊可選的背景圖（整個卡片背景，不是小圖示），key 跟
  // components/dream/caption-image-options.ts 的 WEEKEND_TRIP_IMAGE_OPTIONS 對應。
  weekendTripBannerGetup: "/icons/dream/banner-getup.png",
  weekendTripBannerTired: "/icons/dream/banner-tired.png",
  // 完全沒設定過任何一組時，畫面退回的預設圖，用第一張代表。
  weekendTripBanner: "/icons/dream/banner-getup.png",

  navHome: "/icons/dream/nav-home.png",
  navTrips: "/icons/dream/nav-trips.png",
  navOther: "/icons/dream/nav-other.png",

  modeTrain: "/icons/dream/mode-train.png",
  modeThsr: "/icons/dream/mode-thsr.png",
  modeBus: "/icons/dream/mode-bus.png",
  modeMetro: "/icons/dream/mode-metro.png",

  weatherSunny: "/icons/dream/weather-sunny.png",
  weatherCloudy: "/icons/dream/weather-cloudy.png",
  weatherRain: "/icons/dream/weather-rain.png",

  // 備忘錄可選的圖示，key 跟 components/dream/memo-icons.ts 的 MEMO_ICON_OPTIONS 對應。
  memoDrinks: "/icons/dream/memo-drinks.png",
  memoTicket: "/icons/dream/memo-ticket.png",
  memoWork: "/icons/dream/memo-work.png",
  memoShop: "/icons/dream/memo-shop.png",
  memoBill: "/icons/dream/memo-bill.png",
  memoTime: "/icons/dream/memo-time.png",
  memoMap: "/icons/dream/memo-map.png",
  memoMeal: "/icons/dream/memo-meal.png",

  // 常用行程可選的圖示，key 跟 components/dream/frequent-trip-icons.ts 的
  // FREQUENT_TRIP_ICON_OPTIONS 對應。
  tripOutbound: "/icons/dream/trip-outbound.png",
  tripInbound: "/icons/dream/trip-inbound.png",
  tripGoout: "/icons/dream/trip-goout.png",
} as const;
