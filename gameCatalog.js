(function attachWebSmallGameCatalog(root) {
  root.WebSmallGameCatalog = [
    {
      id: "snake",
      number: 1,
      enabled: true,
    },
    {
      id: "breakout",
      number: 2,
      enabled: true,
    },
    {
      id: "dodge",
      number: 3,
      enabled: true,
    },
    {
      id: "memory",
      number: 4,
      enabled: true,
    },
  ];
})(typeof globalThis !== "undefined" ? globalThis : window);
