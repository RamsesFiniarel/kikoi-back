export class player {
    constructor(surname, player_id, socket_id) {
        this.surname = surname
        this.player_id = player_id
        this.socket_id = socket_id
        this.is_master = false
      }
}


export class lobby {
    constructor(game_id, round_number, question_style) {
      this.game_id = game_id
      this.round_number = round_number
      this.question_style = question_style
      this.player_connected = []
      console.log("[System]:", "Lobby", game_id, "created")
    }

    add_player(player) {
      this.player_connected.push(player)

      if (this.player_connected.length == 1) {
        player.is_master = true
      }

      console.log("[" + this.game_id + "]:", player.surname, "joined room")
    }

    remove_player(socket_id) {
      let player = this.player_connected.find(player => player.socket_id == socket_id)
      this.player_connected.splice(this.player_connected.indexOf(player),1)

      if (player.is_master && this.player_connected.length > 0) {
        this.player_connected[0].is_master = true
      }

      console.log("[" + this.game_id + "]:", player.surname, "exited room")
    }
}