// gather classes
import * as classes from './classes.js'


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


// lobby & game variables
let lobby_list = []
let game_list = []


// create server
app.get("/", (req, res) => {
    res.write("Socket start on port: " + PORT)
    res.end()
})
httpServer.listen(PORT, () => {console.log("Server is up running on PORT " + PORT)})


// handle connections
io.on("connection", (socket) => {

    // user wants to create a lobby
    socket.on("create_lobby", ({game_id, round_number, question_style}) => {
        let new_lobby = new classes.lobby(game_id, round_number, question_style)
        lobby_list.push(new_lobby)
        socket.emit("lobby_created")
    })


    // user joined a lobby
    socket.on("join_lobby", ({surname, player_id, game_id}) => {
        let lobby = lobby_list.find(lobby => lobby.game_id == game_id)
        
        // if lobby exists, add player to the list and send everyone list of players
        if (lobby) {
            socket.join(game_id)
            let new_player = new classes.player_lobby(surname, player_id, socket.id)
            lobby.add_player(new_player)
            io.in(game_id).emit("players_lobby", lobby.player_connected)
        } 
        // if lobby doesn't, tell player he can't connect
        else {
            socket.emit("unable_to_connect_to_lobby")
            console.log("[System]:", surname, "failed to connect to", game_id, "(Lobby does not exist)")
        }
    })


    // user wants to create a game
    socket.on("create_game", ({game_id}) => {
        let lobby = lobby_list.find(lobby => lobby.game_id == game_id)
        
        // if lobby exists, add player to the list and send everyone list of players
        if (lobby) {
            // create game
            let new_game = new classes.game(game_id, lobby.round_number, lobby.question_style, lobby.player_connected)
            game_list.push(new_game)
            io.in(game_id).emit("game_created")

            // remove lobby
            lobby_list.splice(lobby_list.indexOf(lobby),1)
            console.log("[System]:", "Lobby", game_id, "was removed")
        }
    })


    // user joined a game
    socket.on("join_game", ({surname, player_id, game_id}) => {
        let game = game_list.find(lobby => lobby.game_id == game_id)
        
        // if game exists
        if (game) {
            let new_player = new classes.player_game(surname, player_id, socket)
            let could_add_player = game.add_player(new_player)

            // check if player was in lobby
            if (!could_add_player) {
                socket.emit("unable_to_connect_to_game")
                console.log("[System]:", surname, "failed to connect to", game_id, "(Player was not in lobby)")
            } 
            
            // if player was added check if can start game
            else {
                if (game.player_id_list.length == game.player_connected.length && game.state == "init") {
                    game.state = "sending_round_info"
                    game.send_round_info()
                    console.log("[" + game_id + "]: all players connected, game will start")
                }
            }
        } 
        // if game doesn't exist, tell player he can't connect
        else {
            socket.emit("unable_to_connect_to_game")
            console.log("[System]:", surname, "failed to connect to", game_id, "(Game does not exit)")
        }
    })


    // user disconnected 
    socket.on("disconnecting", () => {
        let rooms = [...socket.rooms]
        // if player connected to a game
        if (rooms.length > 1) {
            let game = game_list.find(game => game.game_id == rooms[1])

            // if player was conected to a game
            if (game) {
                game.remove_player(socket.id)

                if (game.player_connected.length == 0) {
                    game_list.splice(game_list.indexOf(game),1)
                    console.log("[System]:", "Game", rooms[1], "was removed")
                }

            } 
            
            // if no game was found, try to find a lobby and do the same
            else {
                let lobby = lobby_list.find(lobby => lobby.game_id == rooms[1])

                if (lobby) {
                    lobby.remove_player(socket.id)
    
                    if (lobby.player_connected.length > 0) {
                        io.in(rooms[1]).emit("players_lobby", lobby.player_connected)
                    } else {
                        lobby_list.splice(lobby_list.indexOf(lobby),1)
                        console.log("[System]:", "Lobby", rooms[1], "was removed")
                    }
                }
            }
        }
    })
})