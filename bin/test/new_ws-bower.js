var exec = require('child_process').exec;
var fs = require('fs');
var http = require('https');
var util  = require('util');
var Download = require('download');
var checksum = require("checksum");
var spawnSync = require('child_process').spawnSync;

console.log( "WS Bower : Initializing Agent");

var parseBowerJson = function(json){
    var newJson = [];
    for (i in json){
        if(json[i].id == "download"){
            newJson.push(json[i])
        }
    }
    return newJson;
}

var downloadPckgs = function(){
    //need to handle read exception 
    console.log( "WS Bower : Locating Bower Pacakges Source...");
	var bowerJson = parseBowerJson(    JSON.parse(fs.readFileSync("./.ws_bower/ws_bower.json", 'utf8'))    );

    var downloadsObj = new Download({mode: '755'})
	for (i in bowerJson){
			var url = bowerJson[i].message;
            var fileType = url.split("/");
            var depName = bowerJson[i].data.resolver.name;

            fileType = fileType[fileType.length - 1];
            
            console.log(depName + "  :  "+ url);
			
            downloadsObj.get(url,'./.ws_bower/archive/' + depName);
            //download(url, "./.ws_bower/archive" + fileName + fileType);
	}

    downloadsObj.run(function(err,files){
        // console.log(err)
        // console.log(files)

        console.log( "WS Bower : Running CheckSum... ");
        var depWithCheckSum = [];

        var callback = function (err, sum) {
            var sumClc = (typeof (sum) != "undefined") ? sum : "0";
            sumClc = sumClc.toUpperCase();
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
            }
        }


        for (i in bowerJson){
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
exe    = spawnSync('mkdir',['.ws_bower']);
exe    = spawnSync('mkdir',['archive'],{cwd: './.ws_bower'});

console.log( "WS Bower : Locating Original Bower.json...");
//copy original bower.json to install from
exe    = spawnSync('cp',['./bower.json','./.ws_bower/']);


//run bower install and save json (--force to avoid cache) cmd to run in ws folder.
console.log( "WS Bower : Installing and Scanning Dependencies...");
exe    = spawnSync('bower',['install','--json', '--force'],{cwd: './.ws_bower'});

fs.writeFile('./.ws_bower/ws_bower.json', exe.stderr, function (err) {
  if (err) return console.log(err);
  console.log("WS Bower: Downloading Packages...");
  downloadPckgs();
});
