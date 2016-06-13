#!/usr/bin/env node

'use strict';

var fs = require('fs');
var http = require('https');
var util  = require('util');
var Download = require('download');
var checksum = require("checksum");
var shelljs = require("shelljs");
var spawnSync = require('child_process').spawnSync;
var child_process = require('child_process');

console.log( "WS Bower : Initializing Agent");

var noConfMsg = 'Please create a whitesource.config.json to continue';
var fileMsg = 'whitesource.config.json is not a valid JSON file';


var parseBowerJson = function(json){
    var newJson = [];
    for (var i in json){
        if(json[i].id == "checkout"){
            newJson.push(json[i])
        }
    }
    return newJson;
}

var downloadPckgs = function(){
    //need to handle read exception 
    console.log( "WS Bower : Locating Bower Pacakges Source...");
    var file = fs.readFileSync("./ws_bower.json", 'utf8');
    file = file.replace(/(\r\n|\n|\r)/gm,"");

    var fixJson = function(file){
        //go to deps array avoid console log prints at first line.
        file = file.substr(file.indexOf('['),file.length);
        
        if(file.indexOf("]{") != -1){//fix for json output
            file = file.substr(0,file.indexOf("]{") + 1)
            //return fixJson(file);
        }
        return file;
    }
    
    var file = fixJson(file);

    var bowerJson = parseBowerJson(    JSON.parse(file)    );

    var downloadsObj = new Download({mode: '755'})
    for (var i in bowerJson){
            //url example - https://codeload.github.com/{reposOwner}/{repoName}/tar.gz/{tagName}
            /* remove tar.zip after checksum (yossi).
                
            {
              "level": "action",
              "id": "checkout",
              "message": "2.0.5",
              "data": {
                "resolution": {
                  "type": "version",
                  "tag": "2.0.5",
                  "commit": "317bbbfb6ba5367a27146ceffafe31687208bea6"
                },
                "to": "C:\\Users\\mark_\\AppData\\Local\\Temp\\DERBECKER-SQ-1-mark_\\bower\\42ef867131df1c492c5871714f7f094c-24840-rX5Iha",
                "endpoint": {
                  "name": "angular-editable-text",
                  "source": "https://github.com/seeq12/angular-editable-text.git",
                  "target": "2.0.5"
                },   //url example - https://codeload.github.com/{reposOwner}/{repoName}/tar.gz/{tagName}
                     //https://codeload.github.com/seeq12/angular-editable-text/tar.gz/2.0.5
                     //https://codeload.github.com/seeq12/angular-editable-text/tar.gz/2.0.5
                "resolver": {
                  "name": "angular-editable-text",
                  "source": "https://github.com/seeq12/angular-editable-text.git",
                  "target": "2.0.5"
                }
              }
            }

            */


            
            var canTrackPkg = (bowerJson[i].data && bowerJson[i].data.resolver && bowerJson[i].data.resolver.source.indexOf('github'));
            if(canTrackPkg){
                var tag = bowerJson[i].message;
                var resolvedUrl = bowerJson[i].data.resolver.source;
                var url = resolvedUrl.replace('https://github.com','https://codeload.github.com');
                url = url.substr(0,url.lastIndexOf('.git'));
                url = url+'/tar.gz/' + tag;
                var fileType = url.split("/");
                var depName = bowerJson[i].data.resolver.name;

                fileType = fileType[fileType.length - 1];
                
                console.log(depName + "  :  "+ url);
                
                downloadsObj.get(url,'./.ws_bower/archive/' + depName);
            }else{
                //mark as completed if not downloading (example: private repo)
                bowerJson[i]["_ws"] = true;
            }
            //download(url, "./.ws_bower/archive" + fileName + fileType);
    }

    downloadsObj.run(function(err,files){
        // console.log(err)
        // console.log(files)

        console.log( "WS Bower : Running CheckSum... ");
        var depWithCheckSum = [];

        var callback = function (err, sum) {
            var sumClc = (typeof (sum) != "undefined") ? sum : "0";
            sumClc = sumClc.toLowerCase();
            console.log( "  sum: " + sumClc + "  name:" + this.name);

            var dep = {
                "name": this.name,
                "artifactId": this.name,
                "version": this.tarZip.substr(0,this.tarZip.indexOf(".tar.gz")),
                "groupId": this.name,
                "systemPath": null,
                "scope": null,
                "exclusions": [],
                "children": [],
                "classifier": null,
                "sha1": sumClc
            }

            //console.log(dep);

            depWithCheckSum.push(dep)
           
            bowerJson[this.index]["_ws"] = true;
            
            var checkComplete = function(){
                var ans = true;
                for(var i in bowerJson){
                    if(!bowerJson[i]._ws) {
                        ans = false;
                        break;
                    }
                }
                return ans;
            }

            if(checkComplete()){
                console.log( "WS Bower : Finishing Report");
                fs.writeFileSync("./.ws_bower/.ws-sha1-report.json", JSON.stringify(depWithCheckSum, null, 4),{});

                var exec = require('child_process').exec;
                var child = exec('whitesource bower',
                  function(error, stdout, stderr){
                    console.log(  stderr );
                    if (error !== null) {
                      console.log("exec error: " + error);
                    }
                });
            }
        }


        for (var i in bowerJson){
                var url = bowerJson[i].message;
                var tarZip = url.split("/");
                var depName = bowerJson[i].data.resolver.name;
                tarZip = tarZip[tarZip.length - 1];

                // console.log('checksum now for ' + newLoc + "/" + compMainFile);
                checksum.file("./.ws_bower/archive/"+depName+"/"+tarZip, callback.bind({name:depName,tarZip:tarZip,index:i}));
        }

    });
};


console.log( "WS Bower : Strarting Report...");


//make temp folder for installing plugins
//var exe    = spawnSync('mkdir',['.ws_bower']);
//var exe    = spawnSync('mkdir',['archive'],{cwd: './.ws_bower'});

shelljs.rm('-rf', './.ws_bower');
shelljs.mkdir('-p' , '.ws_bower');
shelljs.mkdir('-p' , './.ws_bower/archive');

console.log( "WS Bower : Locating Original Bower.json...");
//copy original bower.json to install from
//var exe    = spawnSync('cp',['./bower.json','./.ws_bower/']);
shelljs.cp('-R', './bower.json', './.ws_bower/');


//run bower install and save json (--force to avoid cache) cmd to run in ws folder.
console.log( "WS Bower : Installing and Scanning Dependencies...");

// var exe = child_process.execSync('bower install --json --force',{cwd: './.ws_bower',encoding: 'utf8'});
// console.log(" \n---- exe ---- \n");
// console.log(exe);
// fs.writeFile('./ws_bower.json', exe, function (err) {
//   if (err) return console.log(err);
//   console.log("WS Bower: Downloading Packages...");
//   downloadPckgs();
// });

var callback = function(code, stdout, stderr) {
    fs.writeFile('./ws_bower.json', stderr, function (err) {
      if (err) return console.log(err);
      console.log("WS Bower: Downloading Packages...");
      downloadPckgs();
    });
}


var initConf = function(){
    var res = null;
     try{
        res = fs.readFileSync('./whitesource.config.json', 'utf8',function(err,data){
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
}

var confJson = initConf();
var child = null;

if(typeof (confJson.devDep) !== "undefined" && (confJson.devDep == "true" || confJson.devDep) ){
    child = shelljs.exec("bower install --json --force --production");
}else{
    child = shelljs.exec("bower install --json --force");
}

callback(0,null,child.output)
