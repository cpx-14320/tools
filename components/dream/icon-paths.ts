// 統一命名、集中管理的圖示路徑清單。相同概念（例如火車圖示）在不同檔案都指向同一個路徑字串，
// 之後只要把檔案放到對應路徑，所有用到的地方會一次全部換成真圖，不用逐一改程式碼。
// 檔案還沒上傳前，ImageSlot／IconImg 會自動用漸層佔位顯示，圖片 404 也不會壞掉。
export const ICON_PATHS = {
  navHome: "/icons/dream/nav-home.png",
  navTrips: "/icons/dream/nav-trips.png",
  navFavorites: "/icons/dream/nav-favorites.png",
  navMore: "/icons/dream/nav-more.png",

  modeTrain: "/icons/dream/mode-train.png",
  modeThsr: "/icons/dream/mode-thsr.png",
  modeBus: "/icons/dream/mode-bus.png",
  modeMetro: "/icons/dream/mode-metro.png",

  quickRoutes: "/icons/dream/quick-routes.png",
  quickFavorites: "/icons/dream/quick-favorites.png",
  quickTimetable: "/icons/dream/quick-timetable.png",
  quickFare: "/icons/dream/quick-fare.png",

  weatherSunny: "/icons/dream/weather-sunny.png",
  weatherCloudy: "/icons/dream/weather-cloudy.png",
  weatherRain: "/icons/dream/weather-rain.png",

  pin: "/icons/dream/pin.png",
  clock: "/icons/dream/clock.png",
  calendar: "/icons/dream/calendar.png",
  search: "/icons/dream/search.png",
  refresh: "/icons/dream/refresh.png",
  station: "/icons/dream/station.png",
  heartFilled: "/icons/dream/heart-filled.png",
  heartOutline: "/icons/dream/heart-outline.png",
  goTop: "/icons/dream/go-top.png",
} as const;
