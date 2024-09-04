// gather questions
import * as question from './question.js';

export class player_lobby {
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

    console.log("[" + this.game_id + "]:", player.surname, "joined lobby")
  }


  remove_player(socket_id) {
    let player = this.player_connected.find(player => player.socket_id == socket_id)
    this.player_connected.splice(this.player_connected.indexOf(player),1)

    if (player.is_master && this.player_connected.length > 0) {
      this.player_connected[0].is_master = true
    }

    console.log("[" + this.game_id + "]:", player.surname, "exited lobby")
  }
}


export class player_game {
  constructor(surname, player_id, socket) {
      this.surname = surname
      this.player_id = player_id
      this.socket = socket
    }
}


export class round {
  constructor(question, detective, imposter, target) {
    this.question = question
    this.detective = detective
    this.imposter = imposter
    this.target = target
  }
}


export class game {
  constructor(game_id, round_number_choice, question_style, player_list) {
    this.game_id = game_id

    this.player_id_list = []
    for (let player of player_list) {
      this.player_id_list.push(player.player_id)
    }
    
    this.player_connected = []
    this.round_list = []
    this.current_round = 0
    this.answer_list = []
    this.state = "init"

    this.init_game(round_number_choice, question_style, player_list)
    
    console.log("[System]:", "Game", game_id, "created")
  }


  add_player(player) {
    if (this.player_id_list.includes(player.player_id)) {
      this.player_connected.push(player)

      let rooms = [...player.socket.rooms]
      if (rooms.includes(this.game_id)) {
        console.log("[" + this.game_id + "]:", player.surname, "joined game")
      } else {
        player.socket.join(this.game_id)
        console.log("[" + this.game_id + "]:", player.surname, "reconnected")
      }
      
      return true
    }

    // return false if player trying to connect was not in the lobby previously
    return false
  }


  remove_player(socket_id) {
    let player = this.player_connected.find(player => player.socket.id == socket_id)
    this.player_connected.splice(this.player_connected.indexOf(player),1)

    console.log("[" + this.game_id + "]:", player.surname, "exited game")
  }


  // create all rounds
  init_game(round_number_choice, question_style, player_list) {
    let round_number = player_list.length
    if (round_number_choice == "6") {
      round_number = 6
    } else if (round_number_choice == "12") {
      round_number = 12
    }

    let questions_list = question.classic_questions
    if (question_style == "alcool") {
      questions_list = [...question.alcool_questions]
    } else if (question_style == "limit") {
      questions_list = [...question.limit_questions]
    } else if (question_style == "mix") {
      questions_list = question.classic_questions.concat(question.alcool_questions, question.limit_questions)
    }
    questions_list = shuffle_array(questions_list).slice(0, round_number)

    let detective_list = player_list
    if (detective_list.length < round_number) {
      detective_list = detective_list.concat(detective_list).concat(detective_list)
    }
    detective_list = shuffle_array(detective_list).slice(0, round_number)
  
    for (let round_idx = 0; round_idx < round_number; round_idx++) {
      let question = questions_list[round_idx]
      let detective = detective_list[round_idx]

      let possible_imposter = [...player_list]
      possible_imposter.splice(possible_imposter.indexOf(detective), 1)
      let imposter = shuffle_array(possible_imposter)[0]

      let possible_target = [...possible_imposter]
      possible_target.splice(possible_target.indexOf(imposter), 1)
      let target = shuffle_array(possible_target)[0]
      
      this.round_list.push(new round(question, detective, imposter, target))
    }
  }


  // send everyone round info
  send_everyone_round_info() {
    let round_info = this.round_list[this.current_round]
    for (let player of this.player_connected) {
      let info = {
        round_number: this.current_round,
        question: round_info.question,
        is_detective: player.player_id == round_info.detective.player_id,
        detective: round_info.detective.surname,
        is_imposter: player.player_id == round_info.imposter.player_id,
        target: player.player_id == round_info.imposter.player_id ? round_info.target.surname : "",
      }

      player.socket.emit("round_info", info)
    }

    this.state = "waiting_for_answers"
  }


  // send one user round info
  send_round_info(player_id) {
    let round_info = this.round_list[this.current_round]
    let player = this.player_connected.find(player => player.player_id == player_id)
    if (player) {
      let info = {
        round_number: this.current_round,
        question: round_info.question,
        is_detective: player.player_id == round_info.detective.player_id,
        detective: round_info.detective.surname,
        is_imposter: player.player_id == round_info.imposter.player_id,
        target: player.player_id == round_info.imposter.player_id ? round_info.target.surname : "",
      }

      player.socket.emit("round_info", info)
    }
  }


  // add answer
  add_answer(player_id, answer) {
    this.answer_list.push({
      player_id: player_id,
      answer: answer
    })
  }


  // retrieve player who answered already
  get_players_having_answered() {
    let surname_list = []
    for (let answer_mapping of this.answer_list) {
      let player = this.player_connected.find(player => player.player_id == answer_mapping.player_id)
      if (player) {
        surname_list.push(player.surname)
      }
    }

    return surname_list
  }


  // send help waiting for others
  send_help_waiting_for_others(player_id) {
    let round_info = this.round_list[this.current_round]
    let player = this.player_connected.find(player => player.player_id == player_id)
    if (player) {
      let help_info = {
        state: "waiting_for_others",
        round_number: this.current_round,
        question: round_info.question,
        is_detective: player.player_id == round_info.detective.player_id,
        detective: round_info.detective.surname,
        is_imposter: player.player_id == round_info.imposter.player_id,
        target: player.player_id == round_info.imposter.player_id ? round_info.target.surname : "",
      }

      player.socket.emit("help_after_dc", help_info)
    }
  }
}


// randomize array in-place using Durstenfeld shuffle algorithm
function shuffle_array(array) {
  let shuffle = [...array]
  for (var i = shuffle.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var temp = shuffle[i];
      shuffle[i] = shuffle[j];
      shuffle[j] = temp;
  }
  return shuffle
}