#!/usr/bin/env node

'use strict';

var fs = require('fs');
var shelljs = require("shelljs");
var spawnSync = require('child_process').spawnSync;
var child_process = require('child_process');
console.log( "WS Bower : Initializing Agent");

var noConfMsg = 'Please create a whitesource.config.json to continue';

var fileMsg = 'whitesource.config.json is not a valid JSON file';
var encoding = 'utf8';
var EMPTY_JSON = "{}";

var fixJson = function(file){
    if (file === EMPTY_JSON) {
        return EMPTY_JSON;
    }
    //fix for json output
    var index = file.indexOf("]{");
    if(index != -1){
        file = file.substr(index + 1,file.length);
    }
    return file;
};

// this is the function for full tree
/*
function collectDependencies(bowerJson) {
    var dependencies = [];
    if (bowerJson != null && bowerJson != undefined) {
        if (bowerJson.hasOwnProperty("dependencies")) {
            var dependenciesJson = bowerJson.dependencies;
            var dependencisKeys = Object.keys(dependenciesJson);
            var key;
            for (key in dependencisKeys) {
                var dependecyJson = dependenciesJson[dependencisKeys[key]];
                var dependency = createDependency(dependecyJson);
                if (dependency != null) {
                    dependency.children = collectDependencies(dependecyJson);
                    dependencies.push(dependency);
                }
            }
        }
    }
    return dependencies;
}*/

function collectDependencies(bowerJson, dependencies) {
    if (bowerJson != null && bowerJson != undefined) {
        if (bowerJson.hasOwnProperty("dependencies")) {
            var dependenciesJson = bowerJson.dependencies;
            var dependencisKeys = Object.keys(dependenciesJson);
            var key;
            for (key in dependencisKeys) {
                var dependecyJson = dependenciesJson[dependencisKeys[key]];
                var dependency = createDependency(dependecyJson);
                if (dependency != null) {
                    dependencies.push(dependency);
                    collectDependencies(dependecyJson, dependencies);
                }
            }
        }
    }
}

function createDependency(depObject) {
    var dep = null;
    if(depObject.hasOwnProperty("pkgMeta")) {
        var versionType = depObject.pkgMeta._resolution.type;
        var depName = depObject.endpoint.name;
        var depVersion = depObject.pkgMeta._resolution.tag;

        if (versionType === "tag" || versionType === "version") {
            dep = {
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
        } else {
            console.log("*We were not able to allocate the bower version for '" + depName + "' in you bower.json file. \t " +
                "At the moment we only support tag, so please modify your bower.json accordingly and run the plugin again.")
        }
    }
    return dep;
}

var sendBowerDataToServer = function() {
    console.log( "WS Bower : Locating Bower Packages Source...");
    var file = fs.readFileSync("./ws_bower.json", 'utf8');
    file = file.replace(/(\r\n|\n|\r)/gm,"");
    file = fixJson(file);
    try {
        var bowerJson = JSON.parse(file);
    } catch (e) {
        badBowerJson();
    }
    var dependencies = [];
    collectDependencies(bowerJson, dependencies);

    console.log( "WS Bower : Finishing Report");
    fs.writeFileSync("./.ws_bower/.ws-sha1-report.json", JSON.stringify(dependencies, null, 4),{});

    var exec = require('child_process').exec;
    var child = exec('whitesource bower -c ' + path,
        function(error, stdout, stderr){
            console.log(stderr);
            if (error !== null) {
                console.log("exec error: " + error);
            }
        });
};

var badBowerJson = function () {
    console.log("Could not parse bower.json - Aborting...");
    process.exit(1);
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
    var conf = null;
    try{
        conf = fs.readFileSync(confPath, encoding, function(err, data){
            if(!err){
                console.log(fileMsg);
                return false;
            }
        });
        conf = JSON.parse(conf);
    }catch(e){
        console.log(noConfMsg);
        return false;
    }
    return conf;
};

// Get custom location config file
var args = process.argv.slice(2);
var path = './whitesource.config.json';
if (args.length >= 2 && args[0] === '-c') {
    path = args[1];
}
var confJson = initConf(path);
var child;
var bowerInstallWithDevDependencies = "bower install --force --silent";
var bowerInstall = "bower install --force --production --silent";

if(typeof (confJson.devDep) !== "undefined" && (confJson.devDep == "true" || confJson.devDep) ){
    execBowerInstall(bowerInstallWithDevDependencies);
} else {
    execBowerInstall(bowerInstall);
}
child = shelljs.exec("bower list --json");
callback(0, null, child.output);

function execBowerInstall(command) {
    try {
        child_process.execSync(command);
    } catch(e) {
        console.log("WS Bower : Failed to execute 'bower install'. Please fix the issue and scan again.");
        process.exit(1);
    }
}
