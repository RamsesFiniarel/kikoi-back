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
        let game = game_list.find(game => game.game_id == game_id)
        
        // if game exists
        if (game) {
            let new_player = new classes.player_game(surname, player_id, socket)
            let could_add_player = game.add_player(new_player)

            // check if player was in lobby
            if (!could_add_player) {
                socket.emit("unable_to_connect_to_game")
                console.log("[System]:", surname, "failed to connect to", game_id, "(Player was not in lobby)")
            } 
            
            // if player was indeed in lobby different actions depending on game state
            else {
                // check if everyone is connected to start game
                if (game.state == "init") {
                    if (game.player_id_list.length == game.player_connected.length) {
                        game.state = "sending_round_info"
                        game.send_everyone_round_info()
                        console.log("[" + game_id + "]: all players connected, game will start")
                    }
                }

                // send him back round info for him to answer
                else if (game.state == "sending_round_info") {
                    game.send_round_info(player_id)
                }

                // check if already sent answer, if yes tell to wait, if no send round info
                else if (game.state == "waiting_for_answers") {
                    let found_answer = game.answer_list.find(answer_mapping => answer_mapping.player_id == player_id)
                    if (found_answer) {
                        game.send_help_waiting_for_others(player_id)
                    } else {
                        game.send_round_info(player_id)
                    }

                    let player_having_answered = game.get_players_having_answered()
                    if (player_having_answered.length > 0) {
                        socket.emit("player_having_answered", player_having_answered)
                    }
                }

                // if waiting for users answers, check if player already sent his
                else if (game.state == "waiting_for_mapping_and_preferred") {
                    let round_info = game.round_list[game.current_round]
                    let is_detective = round_info.detective.player_id == player_id
                    if (is_detective) {
                        if (game.detective_mapping.length > 0) {
                            game.send_waiting_for_round_result(player_id)
                        } else {
                            game.send_help_answers_and_players(player_id)
                        }
                    } else {
                        if (game.preferred_answer_list.find(preferred_answer_mapping => preferred_answer_mapping.player_id == player_id)) {
                            game.send_waiting_for_round_result(player_id)
                        } else {
                            game.send_help_answers_and_players(player_id)
                        }
                    }
                }

                else if (game.state == "waiting_next_round") {
                    game.send_help_round_result(player_id)
                }
            }
        } 
        // if game doesn't exist, tell player he can't connect
        else {
            socket.emit("unable_to_connect_to_game")
            console.log("[System]:", surname, "failed to connect to", game_id, "(Game does not exit)")
        }
    })


    // user sent his answer
    socket.on("send_answer", ({player_id, game_id, answer}) => {
        let game = game_list.find(game => game.game_id == game_id)
        
        // if game exists
        if (game) {
            game.add_answer(player_id, answer)

            let player_having_answered = game.get_players_having_answered()

            // if all answers received, send answers + player list
            if (player_having_answered.length == game.player_id_list.length - 1) {
                game.state = "waiting_for_mapping_and_preferred"
                game.send_answers_and_players(player_having_answered)
            } 
            // if not all answers, send players having answered to all players
            else {
                io.in(game_id).emit("player_having_answered", player_having_answered)
            }
        }
    })


    // user sent his preferred answer
    socket.on("send_preferred_answer", ({player_id, game_id, preferred_answer}) => {
        let game = game_list.find(game => game.game_id == game_id)
        
        // if game exists
        if (game) {
            game.add_preferred_answer(player_id, preferred_answer)

            if (game.detective_mapping.length > 0 && game.player_id_list.length - 1 == game.preferred_answer_list.length) {
                game.compute_round_result()
                const is_last_round = game.current_round == game.round_list.length - 1
                io.in(game_id).emit("round_result", {result_list: game.result_list, point_list: game.point_list, is_last_round: is_last_round})
                game.state = "waiting_next_round"
            }
        }
    })


    // detective sent his mapping
    socket.on("send_mapping", ({game_id, answer_player_mapping}) => {
        let game = game_list.find(game => game.game_id == game_id)
        
        // if game exists
        if (game) {
            game.receive_mapping(answer_player_mapping)

            if (game.detective_mapping.length > 0 && game.player_id_list.length - 1 == game.preferred_answer_list.length) {
                game.compute_round_result()
                const is_last_round = game.current_round == game.round_list.length - 1
                io.in(game_id).emit("round_result", {result_list: game.result_list, point_list: game.point_list, is_last_round: is_last_round})
                game.state = "waiting_next_round"
            }
        }
    })


    // detective ask for next round
    socket.on("send_next_round", (game_id) => {
        let game = game_list.find(game => game.game_id == game_id)
        
        // if game exists
        if (game) {
            game.state = "sending_round_info"
            game.reset_variable_for_next_round()
            game.send_everyone_round_info()
        }
    })


    // detective ask for result
    socket.on("send_to_result", (game_id) => {
        let game = game_list.find(game => game.game_id == game_id)
        
        // if game exists
        if (game) {
            io.in(game_id).emit("go_to_result")
            console.log("[" + game_id + "]: game just ended")
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