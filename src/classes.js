// gather questions
import * as question from './question.js';

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


export class game {
  constructor(game_id, round_number, question_style, player_list) {
    this.game_id = game_id
    this.round_number = round_number
    this.question_style = question_style
    this.player_list = player_list
    this.player_connected = []
    this.round_list = []

    let questions_list = question.classic_questions
    if (question_style == "alcool") {
      questions_list = [...question.alcool_questions]
    } else if (question_style == "limit") {
      questions_list = [...question.limit_questions]
    } else if (question_style == "mix") {
      questions_list = question.classic_questions.concat(question.alcool_questions, question.limit_questions)
    }
    questions_list = shuffle_array(questions_list).slice(0, this.player_list.length)
    console.log(questions_list)
    
    console.log("[System]:", "Game", game_id, "created")
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

/*
// init questionsList and detectivesList
function initGame(game) {
  let questionsList = classicQuestions
  if (game.mode == "alcool") {
      questionsList = [...alcoolQuestions]
  } else if (game.mode == "limit") {
      questionsList = [...limitQuestions]
  } else if (game.mode == "mix") {
      questionsList = classicQuestions.concat(alcoolQuestions, limitQuestions)
  }
  questionsList = shuffleArray(questionsList).slice(0,game.players.length)
  game.questionsList = questionsList


  let detectivesList = shuffleArray(game.players)
  if (game.numRound == "6") {
      detectivesList = []
      while (detectivesList.length < 6) {
          detectivesList.push(game.players[Math.floor(Math.random()*game.players.length)])
      }
  } else if (game.numRound == "12") {
      detectivesList = []
      while (detectivesList.length < 12) {
          detectivesList.push(game.players[Math.floor(Math.random()*game.players.length)])
      }
  }
  game.detectivesList = detectivesList
}


// select a random detective out of the ones left, as well as an imposter/target couple and a question
function initRound(game) {
  let question = game.questionsList[0]
  game.currentQuestion = question
  game.questionsList.shift()


  let detective = game.detectivesList[0]
  game.currentDetective = detective
  game.detectivesList.shift()

  let possibleImposters = shuffleArray(game.players)
  possibleImposters.splice(possibleImposters.indexOf(detective),1)
  let imposter = possibleImposters[0]
  let target = possibleImposters[1]
  game.currentImposter = {imposter: imposter, target: target}

  game.currentAnswers = []
}
*/


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