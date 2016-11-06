   var 
        gameport        = process.env.PORT || 4004,
        http            = require('http'),

        express         = require('express'),
        UUID            = require('node-uuid'),

        verbose         = false,
        app             = module.exports.app = express(),
        server          = http.createServer(app);

    //Tell the server to listen for incoming connections
    server.listen( gameport );
    var io              = require('socket.io').listen(server);

    //Log something so we know that it succeeded.
    console.log('\t :: Express :: Listening on port ' + gameport );

    //By default, we forward the / path to index.html automatically.
    app.get( '/', function( req, res ){ 
        res.sendfile( __dirname + '/index.html' );
    });


    //This handler will listen for requests on /*, any file from the root of our server.
    //See expressjs documentation for more info on routing.
    app.get( '/*' , function( req, res, next ) {
        var file = req.params[0];
        if(verbose) console.log('\t :: Express :: file requested : ' + file);
        if(verbose) console.log('\t' + __dirname + '/index.html' );
        res.sendfile( __dirname + '/index.html' );

    }); //app.get *

    var sio = io;
    var STATE_IN_LOBBY  = "inLobby",
        STATE_IN_GAME   = "inGame",

        ROLE_CHASER     = "chaser",
        ROLE_RUNNER     = "runner"

        PLAYER_INFO     = "playerInfo";

    /*
     * Sets up initial player object 
     */
    var Player = function Player(client) {//, name, xPos, yPos, xVel, yVel, color, state, role, score) {
      this.client = client;
      this.name = "";
      this.xPos = 0;
      this.yPos = 0;
      this.xVel = 0;
      this.yVel = 0;
      this.color = "#ff0000";
      this.state = STATE_IN_LOBBY;
      this.role = "";
      this.score = 0;
      this.game = null;
      this.create();
    }

    /*
     * Function called for when player disconnects.
     * Not fully functional with games yet
     */
    Player.prototype.disconnected = function() {
      //TODO: SEND THIS TWO GAMES THAT HAVE THIS USER
      JSON.stringify( {
          "action" : "disconnected",
          "uuid" : this.client.uuid
        });
    }

    /*
     * Part of player setting up process.
     */
    Player.prototype.create = function() {
      var temp = JSON.stringify( {
          "action" : "create_player",
          "uuid" : this.client.uuid
      });
      this.client.emit(PLAYER_INFO, temp);
    }

    /*
     * Returns whether the player is in lobby.
     */
    Player.prototype.inLobby = function() {
      return (this.state == STATE_IN_LOBBY);
    }

    /*
     * Object containing information about the player.
     */
    var Game = function Game(playerArr) {
      this.playerArr = playerArr; //list of players in game
      this.uuid = UUID(); //specific id of game
    }

    /*
     * Gets all player data for a given Game and returns it
     * as a JSON array of player data.
     */
    function getPlayerDataAsJSON(game) {
      var pData = [];
      game.playerArr.forEach(function (item) {
        var data = {
          "xPos" : item.player.xPos,
          "yPos" : item.player.yPos,
          "color" : item.player.color,
          "score" : item.color.score,
        };
        var u = item.client.uuid;
        pData.push({ [u] : data});
      });
      console.log("data [" + JSON.stringify(pData) + "]");
      return pData;
    }

    /*
     * Sends player data for a given game to all players
     */
    Game.prototype.sendPlayerData = function() {
      var jsonPlayers = {
        "action" : "game_player_data",
        "players" : getPlayerDataAsJSON(this)
      }
      this.playerArr.forEach(function(item) {
        item.client.emit("playerInfo", jsonPlayers);
      });
    }

    //List of overall players in the whole application
    var players = [];

    /*
     *  Returns a list of Users that are in a Lobby
     */
    function getPlayersInLobby() {
      var uList = [];
      players.forEach(function(item, index){
        console.log("item [" + item.name + "]");
        if(item.inLobby()) {
          uuID = item.client.uuid;
          uList.push( JSON.parse("{\"" + uuID + "\":\"" + item.name + "\"}"));
        }
      });
      return JSON.stringify({
        "action" : "in_lobby",
        "players" : JSON.stringify(uList)
      });
    }

    /*
     * Sets uuid for user up with a player name.
     * ONLY SHOULD BE USED ONCE!!! ON PLAYER SETUP
     */
    function setPlayerName(uuid, playerName) {
      players.forEach(function(item, index){
        if(item.client.uuid == uuid) {
          item.name = playerName
        }
        // console.log("player [" + item.name + "]");
      });
    }

    /*
     * Removes player from players
     */
    function playerDisconnect(userid){
      //removes specific player from players
      players = players.filter(function(item){
        if(item.client.uuid != userid) {
          // console.log("Saving [" + userid + "]");
          return true;
        } else {
          // console.log("Removing [" + userid + "]");
          item.disconnected();
          return false;
        }
      });
    }

    sio.sockets.on('connection', function (client) {

        client.uuid = UUID();

        //Add new user to a list
        players.push(new Player(client));

        client.on('chatMessage', function(msg){
          console.log('msg: ' + msg);
        });

        client.on(PLAYER_INFO, function(msg){
          var msgOb = JSON.parse(msg);
          console.log(msg + " action [" + msgOb.action + "]");
          switch(msgOb.action) {
              case "in_lobby":
                console.log("sending for lobby");
                client.emit(PLAYER_INFO, getPlayersInLobby());
              case "create_player":
                console.log("creating player finalization");
                setPlayerName(msgOb.uuid, msgOb.name);
              case "game_player_data":
                //ONLY FOR TESTING
                console.log("request player data");
                // client.emit(PLAYER_INFO, );
              case "request_to_play_player":
                console.log("req to play");
            };
        });

        //Useful to know when someone connects
        console.log('\t socket.io:: player ' + client.userid + ' connected');
        
        //When this client disconnects
        client.on('disconnect', function () {
            //Useful to know when someone disconnects
            console.log('\t socket.io:: client disconnected ' + client.uuid );
            //TODO: FIX this up
            //Remove player from uList
            playerDisconnect(client.uuid);
        }); //client.on disconnect
    }); //sio.sockets.on connection