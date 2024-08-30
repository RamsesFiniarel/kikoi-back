// gather questions
/*import { classicQuestions, alcoolQuestions, limitQuestions } from "./questions.js";*/

// 📁 main.js
import {sayHi, sayBye} from './test.js';

// initialize server variables
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: true,
    origin: ["*"]
});
const PORT = process.env.PORT || 55732;


// create server
app.get("/", (req, res) => {
    res.write("Socket start on port: "+PORT)
    res.end()
})
httpServer.listen(PORT, () => {console.log("Server is up running on PORT "+PORT)})