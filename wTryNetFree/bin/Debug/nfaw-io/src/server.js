var net = require('net');
var socks = require('socks-handler');
var socketIoClient = require("socket.io-client");
var ss = require('socket.io-stream');
var HttpProxyAgent = require('http-proxy-agent');
var querystring = require("querystring");
var fs = require("fs");
const child_process = require('child_process');
const path = require('path');

var argv = require('minimist')(process.argv.slice(2));
var config = JSON.parse(fs.readFileSync(argv.c));

console.log(argv);

var clientProxy;

var server = net.createServer(function(clientConnection) {
    clientConnection.on('error', function(err) {
        return console.log('clientConnection', err);
    });
    
    socks.handle(clientConnection, function(err, handler) {
        if (err) {
            console.log(err);
            return;
        }
        
        handler.on('error', function(err) {
            console.log('handler', err);
        });
        
        handler.on('request', function(arg, callback) {
            var command, host, onConnectError, port, serverConnection, version;
            version = arg.version, command = arg.command, host = arg.host, port = arg.port;
            
            if (command !== socks[5].COMMAND.CONNECT) {
                if (version === 5) {
                    callback(socks[5].REQUEST_STATUS.COMMAND_NOT_SUPPORTED);
                }
                else {
                    callback(socks[4].REQUEST_STATUS.REFUSED);
                }
                return;
            }
            console.log(port, host);
            
            var stream = ss.createStream();
            
            stream.pipe(clientConnection).pipe(stream);
            ss(clientProxy).emit('connect', stream, {port: port, host: host});
            
            var status = version === 5 ? socks[5].REQUEST_STATUS.SUCCESS : socks[4].REQUEST_STATUS.GRANTED;
            callback(status);
            
            
            /*
            serverConnection = net.createConnection(port, host);
            clientConnection.pipe(serverConnection).pipe(clientConnection);
            
            
            return serverConnection.on('error', onConnectError = function(err) {
                var status;
                if (version === 5) {
                    status = (function() {
                        switch (err.code) {
                            case 'EHOSTUNREACH':
                                return socks[5].REQUEST_STATUS.HOST_UNREACHABLE;
                            case 'ECONNREFUSED':
                                return socks[5].REQUEST_STATUS.CONNECTION_REFUSED;
                            case 'ENETUNREACH':
                                return socks[5].REQUEST_STATUS.NETWORK_UNREACHABLE;
                            default:
                                return socks[5].REQUEST_STATUS.SERVER_FAILURE;
                        }
                    })();
                }
                else {
                    status = socks[4].REQUEST_STATUS.FAILED;
                }
                
                callback(status);
            }).on('connect', function() {
                var status;
                serverConnection.removeListener('error', onConnectError);
                status = version === 5 ? socks[5].REQUEST_STATUS.SUCCESS : socks[4].REQUEST_STATUS.GRANTED;
                callback(status);
            }).on('error', function(err) {
                console.log('serverConnection', err, host, port);
            });
            */
        });
    });
});

var opt = {};

if(config.http_proxy){
	opt.agent = new HttpProxyAgent(config.http_proxy);
	console.log("http proxy:",config.http_proxy);
}
    
 opt.query = querystring.stringify({
    username: config.username,
    password: config.password
});

clientProxy = socketIoClient.connect(config.url,opt);

console.log(process.env.http_proxy);

clientProxy.on('connect', function(){
	console.log('connect')
	server.listen(config.listen || 1080 ,"127.0.0.1");
	
	if(config.firefox && config.firefoxprofile){
		var p = child_process.spawn(path.normalize(path.join(__dirname,config.firefox)),["-profile",path.normalize(path.join(__dirname,config.firefoxprofile))]);
		p.on('exit',function(){
			process.exit();
		});
	}
});
clientProxy.on('event', function(data){
	console.log('event')
});
clientProxy.on('disconnect', function(){
	console.log('disconnect');
	server.close();
});
  
clientProxy.on('error',function(error){
	console.log(error);
});



console.log("listen socks server");
