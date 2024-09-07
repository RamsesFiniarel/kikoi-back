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
    this.points = 0
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


export class answer_result {
  constructor(answer, preferred_answer, writer_surname, detective_choice_surname_list, did_match_correctly, writer_was_imposter, 
    target_surname, did_detective_swapped_imposter_target, did_imposter_wrote_the_same_as_target) {
    this.answer = answer
    this.preferred_answer = preferred_answer
    this.writer_surname = writer_surname
    this.detective_choice_surname_list = detective_choice_surname_list
    this.did_match_correctly = did_match_correctly
    this.writer_was_imposter = writer_was_imposter
    this.target_surname = target_surname
    this.did_detective_swapped_imposter_target = did_detective_swapped_imposter_target
    this.did_imposter_wrote_the_same_as_target = did_imposter_wrote_the_same_as_target
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
    this.preferred_answer_list = []
    this.detective_mapping = []
    this.result_list = []
    this.point_list = []
    this.state = "init"

    this.init_game(round_number_choice, question_style, player_list)
    
    console.log("[System]:", "Game", game_id, "created")
  }


  reset_variable_for_next_round() {
    this.current_round += 1
    this.answer_list = []
    this.preferred_answer_list = []
    this.detective_mapping = []
    this.result_list = []
    this.point_list = []
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
    let surname_and_id_list = []
    for (let answer_mapping of this.answer_list) {
      let player = this.player_connected.find(player => player.player_id == answer_mapping.player_id)
      if (player) {
        surname_and_id_list.push({
          surname: player.surname,
          player_id: player.player_id
        })
      }
    }

    return surname_and_id_list
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


  // send answers and players
  send_answers_and_players(player_having_answered) {
    let answers = []
    for (let answer_mapping of this.answer_list) {
      answers.push(answer_mapping.answer)
    }
    answers = shuffle_array(answers)

    for (let player of this.player_connected) {
      let answer_mapping = this.answer_list.find(answer_mapping => answer_mapping.player_id == player.player_id)
      let my_answer = -1
      if (answer_mapping) {
        my_answer = answers.indexOf(answer_mapping.answer)
      }
      player.socket.emit("answers_and_players", {answers: answers, surname_and_id_list: player_having_answered, my_answer: my_answer})
    }
  }


  send_help_answers_and_players(player_id) {
    let answers = []
    for (let answer_mapping of this.answer_list) {
      answers.push(answer_mapping.answer)
    }
    answers = shuffle_array(answers)

    let player = this.player_connected.find(player => player.player_id == player_id)
    let answer_mapping = this.answer_list.find(answer_mapping => answer_mapping.player_id == player.player_id)
    let my_answer = -1
    if (answer_mapping) {
      my_answer = answers.indexOf(answer_mapping.answer)
    }

    let player_having_answered = this.get_players_having_answered()

    let round_info = this.round_list[this.current_round]
    
    let state = "choosing_preferred_answer"
    if (round_info.detective.player_id == player_id) {
      state = "defining_mapping"
    }

    let help_info = {
      state: state,
      round_number: this.current_round,
      question: round_info.question,
      is_detective: player.player_id == round_info.detective.player_id,
      detective: round_info.detective.surname,
      is_imposter: player.player_id == round_info.imposter.player_id,
      target: player.player_id == round_info.imposter.player_id ? round_info.target.surname : "",
      answers: answers,
      surname_and_id_list: player_having_answered,
      my_answer: my_answer
    }

    player.socket.emit("help_after_dc", help_info)
  }


  send_waiting_for_round_result(player_id) {
    let round_info = this.round_list[this.current_round]
    let player = this.player_connected.find(player => player.player_id == player_id)
    if (player) {
      let help_info = {
        state: "waiting_round_result",
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


  // add preferred answer
  add_preferred_answer(player_id, answer) {
    this.preferred_answer_list.push({
      player_id: player_id,
      answer: answer
    })
  }


  // receive mapping
  receive_mapping(detective_mapping) {
    this.detective_mapping = detective_mapping
  }


  // compute round results
  compute_round_result() {
    let round_info = this.round_list[this.current_round]

    // find players who won preferred answer
    // code looks complicated because players might have the same surname + same answer
    let preferred_answer_occ = {}
    let chosen_answer = []
    let max = 1
    for (let answer_mapping of this.preferred_answer_list) {
      let answer = answer_mapping.answer
      preferred_answer_occ[answer] = preferred_answer_occ[answer] ? preferred_answer_occ[answer] + 1 : 1;

      if (preferred_answer_occ[answer] > max) {
        max = preferred_answer_occ[answer]
        chosen_answer = [answer]
      } else if (preferred_answer_occ[answer] == max) {
        chosen_answer.push(answer)
      }
    }

    let player_who_won_preferred_answer = []
    for (let answer_mapping of this.answer_list) {
      if (chosen_answer.includes(answer_mapping.answer)) {
        player_who_won_preferred_answer.push(answer_mapping.player_id)
        this.player_connected.find(player => player.player_id == answer_mapping.player_id).points += 1
      }
    }


    // find players who were found by the detective
    let player_who_were_correctly_matched = []
    for (let detective_choice of this.detective_mapping) {
      let real_mapping = this.answer_list.find(answer_mapping => answer_mapping.player_id == detective_choice.player_id)
      if (real_mapping.answer == detective_choice.answer) {
        player_who_were_correctly_matched.push(detective_choice.player_id)
      }
    }

    this.player_connected.find(player => player.player_id == round_info.detective.player_id).points += player_who_were_correctly_matched.length


    // find if detective swapped imposter and target
    let imposter_answer = this.answer_list.find(answer_mapping => answer_mapping.player_id == round_info.imposter.player_id).answer
    let detective_supposed_target_answer = this.detective_mapping.find(answer_mapping => answer_mapping.player_id == round_info.target.player_id).answer
    const did_detective_swapped_imposter_target = imposter_answer == detective_supposed_target_answer

    if (did_detective_swapped_imposter_target) {
      this.player_connected.find(player => player.player_id == round_info.imposter.player_id).points += 2
    }

    // find if imposter wrote exactly the same answer as his target
    let target_answer = this.answer_list.find(answer_mapping => answer_mapping.player_id == round_info.target.player_id).answer
    const did_imposter_wrote_the_same_as_target = imposter_answer == target_answer

    if (did_imposter_wrote_the_same_as_target) {
      this.player_connected.find(player => player.player_id == round_info.imposter.player_id).points += 3
    }


    // create answer list
    for (let answer_mapping of this.answer_list) {
      let answer = answer_mapping.answer
      let preferred_answer = player_who_won_preferred_answer.includes(answer_mapping.player_id)

      let writer = this.player_connected.find(player => player.player_id == answer_mapping.player_id)
      let writer_surname = writer.surname

      let detective_choice_surname_list = []
      for (let detective_choice of this.detective_mapping) {
        if (detective_choice.answer == answer && detective_choice.player_id != writer.player_id) {
          detective_choice_surname_list.push(this.player_connected.find(player => player.player_id == detective_choice.player_id).surname)
        }
      }

      let did_match_correctly = player_who_were_correctly_matched.includes(answer_mapping.player_id)

      let writer_was_imposter = false
      let target_surname = ""
      let player_did_detective_swapped_imposter_target = false
      let player_did_imposter_wrote_the_same_as_target = false

      if (round_info.imposter.player_id == answer_mapping.player_id) {
        writer_was_imposter = true
        target_surname = round_info.target.surname
        player_did_detective_swapped_imposter_target = did_detective_swapped_imposter_target
        player_did_imposter_wrote_the_same_as_target = did_imposter_wrote_the_same_as_target
      }

      let new_result = new answer_result(answer, preferred_answer, writer_surname, detective_choice_surname_list, did_match_correctly,
        writer_was_imposter, target_surname, player_did_detective_swapped_imposter_target, player_did_imposter_wrote_the_same_as_target)
      
      this.result_list.push(new_result)
    }

    this.compute_point_list()
  }


  // return mapping between player id and points
  compute_point_list() {
    let point_list = []
    for (let player of this.player_connected) {
      point_list.push({
        surname: player.surname,
        player_id: player.player_id,
        points: player.points
      })
    }

    this.point_list = point_list
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