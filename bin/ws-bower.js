#!/usr/bin/env node

'use strict';

var fs = require('fs');
var shelljs = require("shelljs");
var spawnSync = require('child_process').spawnSync;
var child_process = require('child_process');
console.log( "WS Bower : Initializing Agent");

var noConfMsg = 'Please create a whitesource.config.json to continue';

var fileMsg = 'whitesource.config.json is not a valid JSON file';
var finishedId = "install";

var fixJson = function(file){
    //go to deps array avoid console log prints at first line.
    file = file.substr(file.indexOf('['),file.length);

    //fix for json output
    if(file.indexOf("]{") != -1){
        file = file.substr(0,file.indexOf("]{") + 1);
    }
    return file;
};

var sendBowerDataToServer = function() {
    console.log( "WS Bower : Locating Bower Packages Source...");
    var file = fs.readFileSync("./ws_bower.json", 'utf8');
    file = file.replace(/(\r\n|\n|\r)/gm,"");
    var file = fixJson(file);
    var bowerJson = parseBowerJson(    JSON.parse(file)    );
    var deps = [];


    for (var i in bowerJson) {
        var versionType = bowerJson[i].data.pkgMeta._resolution.type;
        var depName = bowerJson[i].data.endpoint.name;
        var depVersion = bowerJson[i].data.pkgMeta._resolution.tag;

        if (versionType === "tag" || versionType === "version") {
            var dep = {
                "name": depName,
                "artifactId": depName,
                "version": depVersion,
                "groupId": depName,
                "systemPath": null,
                "scope": null,
                "exclusions": [],
                "children": [],
                "classifier": null,
                "sha1": null
            };

            deps.push(dep);
            console.log("Package: " + depName + "  || Version: " + depVersion);
        } else {
            console.log("*We were not able to allocate the bower version for '" + depName + "' in you bower.json file. \t " +
                "At the moment we only support tag, so please modify your bower.json accordingly and run the plugin again.")
        }
    }

    if (deps.length > 0) {
        console.log( "WS Bower : Finishing Report");
        fs.writeFileSync("./.ws_bower/.ws-sha1-report.json", JSON.stringify(deps, null, 4),{});

        var exec = require('child_process').exec;
        var child = exec('whitesource bower -c ' + path,
            function(error, stdout, stderr){
                console.log(  stderr );
                if (error !== null) {
                    console.log("exec error: " + error);
                }
            });
    } else {
        console.log("No dependencies found - Aborting...");
    }
};

var parseBowerJson = function(json){
    var newJson = [];
    for (var i in json){
        if(json[i].id == finishedId){
            newJson.push(json[i])
        }
    }
    return newJson;
};

console.log( "WS Bower : Starting Report...");

shelljs.rm('-rf', './.ws_bower');
shelljs.mkdir('-p' , '.ws_bower');
shelljs.mkdir('-p' , './.ws_bower/archive');

console.log( "WS Bower : Locating Original Bower.json...");
//copy original bower.json to install from
shelljs.cp('-R', './bower.json', './.ws_bower/');


//run bower install and save json (--force to avoid cache) cmd to run in ws folder.
console.log( "WS Bower : Installing and Scanning Dependencies...");


var callback = function(code, stdout, stderr) {
    fs.writeFile('./ws_bower.json', stderr, function (err) {
      if (err) return console.log(err);
        console.log("WS Bower: Getting Packages Data...");
        sendBowerDataToServer();
    });
};

var initConf = function(confPath){

    var res = null;
     try{
        res = fs.readFileSync(confPath, 'utf8',function(err,data){
            if(!err){
                console.log(fileMsg);
                return false;
            }
        }); 
        res = JSON.parse(res);
    }catch(e){
        console.log(noConfMsg);

        return false;
    }
    return res;
};

// Get custom location config file
var args = process.argv.slice(2);
var path = './whitesource.config.json';
if (args.length >= 2 && args[0] === '-c') {
    path = args[1];
}
var confJson = initConf(path);
var child = null;

if(typeof (confJson.devDep) !== "undefined" && (confJson.devDep == "true" || confJson.devDep) ){
    child = shelljs.exec("bower install --json --force --production");
}else{
    child = shelljs.exec("bower install --json --force");
}

callback(0,null,child.output);
