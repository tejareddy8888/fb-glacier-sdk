import startServer from "./server";
(() => {
  try {
    console.log("server starting...");
    startServer();
  } catch (e) {
    console.log(e);
  }
})();
