import startServer from "./server.js";
(() => {
  try {
    console.log("server starting...");
    startServer();
  } catch (e) {
    console.log(e);
  }
})();
