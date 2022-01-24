import express from "express";
import http from "http";
const app = express();
const server = http.createServer(app);
import { Server } from "socket.io";
const io = new Server(server, { cors: { origin: "*" } });
import dotenv from "dotenv";
dotenv.config();

app.set("json spaces", 4);
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "X-Requested-With");
    next();
});
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("private"));
app.use(express.static("static"));

server.listen(process.env.PORT, async () => {
    console.log(`API Ready! (${process.env.PORT})`);
    
    app.get("/short/go/:domain/:id", async (req, res) => (await import("./socket/short/go.js")).default(req, res));
    app.get("/yt/watch/:id", async (req, res) => (await import("./socket/yt/watch.js")).default(req, res));
    app.get("/teapot/", (req, res) => res.sendStatus(418));
    (await import("./uptimerobot.js")).default(app);
    (await import("fs")).readdirSync("./discord").forEach(async x => (await import(`./discord/${x}/bot.js`)).default());
    
    io.on("connection", async (socket) => (await import("./socket/socket.js")).default(io, socket));
});