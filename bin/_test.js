var exec = require('child_process').exec;
var fs = require('fs');

// function execute(command, callback){
//     exec(command, function(error, stdout, stderr){ callback(stdout); });
// };

var cmnd = "bower install d3 --json";

// execute(cmnd,function(stdout){
// 	fs.writeFile('test.json', stdout, function (err) {
// 	  if (err) return console.log(err);
// 	  console.log('test.json > test.json');
// 	});
// });


var util  = require('util'),
    spawn = require('child_process').spawn,
    //exe    = spawn('bower',['install','jquery','--json']);

//make temp folder for installing plugins
exe    = spawn('mkdir',['.ws_bower']);

//copy original bower.json to install from
exe    = spawn('cp',['./bower.json','./.ws_bower/']);

//cd to temp dir
exe    = spawn('cd',['./.ws_bower']);

//run bower install and save json (--force to avoid cache)
exe    = spawn('bower',['install','--json', '--force']);


var buffer = [];
exe.stdout.on('data', function (data) {
	fs.writeFile('test.json.' + new Date() , buffer, function (err) {
	  if (err) return console.log(err);
	});
  buffer += data;
});

exe.stderr.on('data', function (data) {
	fs.writeFile('test.json.' + new Date() , buffer, function (err) {
	  if (err) return console.log(err);
	});
  buffer += data;
});

exe.on('exit', function (code) {
  console.log('child process exited with code ' + code);
	fs.writeFile('test.json', buffer, function (err) {
	  if (err) return console.log(err);
	});
});