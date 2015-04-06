var http = require('http');
var https = require('https');
var fs = require('fs');
var cli = require('cli');
var querystring = require('querystring');
var baseURL = 'saas.whitesourcesoftware.com';
var bowerDeps = {};
var postJSON = {dependencies:[]};
var checkPolSent = false;
var runtime = new Date().valueOf();

var buildCallback = function(resJson){
	var timer = new Date().valueOf() - runtime;
	timer = timer / 1000;
	

	var finish = function(){
		cli.ok('Build success!' + " ( took: " + timer +"s ) " );
		process.exit(0);
	}

	finish();
}


var readConfJson = function(){
	try{
		var noConfMsg = 'Please create a whitesource.config.json to continue';
		var fileMsg = 'whitesource.config.json is not a valid JSON file';
		confJson = fs.readFileSync('./whitesource.config.json', 'utf8',
		function(err,data){
			if(!err){
				cli.error(fileMsg);
				return false;
			}
		});	
		return JSON.parse(confJson);
	}catch(e){
		cli.error(noConfMsg);
		return false;
	}
}


var buildReport = function(confJson){
	var depsArray = [];
	try{
		bowerFile = JSON.parse(fs.readFileSync('./bower.json', 'utf8'));
	}catch(e){
		cli.error('Problem reading Bower.json, please check the file exists and is a valid JSON');
		return false;
	}

	try{
		postJSON.name = bowerFile.name;
		postJSON.version = bowerFile.version;
	}catch(e){
		cli.error('Problem reading Bower.json, please check that you added a NAME and VERSION to the bower.json file.');
		return false;
	}

	bowerDeps = bowerFile.dependencies;

	Object.keys(bowerDeps).forEach(function(key){
		var item = {};
		item['name'] = key;
		item['version'] = bowerDeps[key];
		item['groupId'] = key;
		item['systemPath'] = null;
		item['scope'] = null;
		item['exclusions'] = [];
		item['children'] = [];
		item['classifier'] = null;
		depsArray.push(item);
	});

        		/*value[i].groupId = i;
        		value[i].systemPath = null;
        		value[i].scope = null;;
        		value[i].exclusions = [];
				value[i].classifier = null;*/

	postJSON.dependencies = depsArray;

	return postJSON;
}

var postJson = function(report,confJson){
	cli.ok('Getting ready to post report to WhiteSource...');
	var isHttps = true;

	if(typeof(confJson.https) !== "undefined"){
		 isHttps = confJson.https;
	}
	
	var reqHost = (confJson.baseURL) ? confJson.baseURL : baseURL;
	var port = (confJson.port) ? confJson.port : "443";
	var productName = (confJson.productName) ? confJson.productName : report.name;
	var productVer = (confJson.productVersion) ? confJson.productVersion : report.version;
	var productToken = (confJson.productToken) ? confJson.productToken : "";
	var projectName = (confJson.projectName) ? confJson.projectName : report.name;
	var projectVer = (confJson.projectVer) ? confJson.projectVer : report.version;
	var projectToken = (confJson.projectToken) ? confJson.projectToken : "";
	var ts = new Date().valueOf();
	var post_req;

	if(!confJson.apiKey){
		//console.log(confJson.apiKey)
		cli.error('Cant find API Key, please make sure you input your whitesource API token in the whitesource.config file.');
		return false
	}
	
	if(projectToken && productToken){
		cli.error('Cant use both project Token & product Token please select use only one token,to fix this open the whitesource.config file and remove one of the tokens.');
		return false
	}

	var json = [{
		dependencies:report.dependencies,
		name:report.name,
		version:report.version,
		coordinates:{
        	"artifactId": report.name,
	        "version":report.version
    	}
	}]

	fs.writeFile("whitesource.report.json", JSON.stringify(json, null, 4), function(err) {
	    if(err){
	      cli.error(err);
	    } else {
	      
	    }
	}); 
	
	var checkPol = (confJson.checkPolicies) ? confJson.checkPolicies : true;
	var myReqType = ((checkPol && !checkPolSent) ? 'CHECK_POLICIES' : 'UPDATE');

	if(!confJson.checkPolEnabled){
		myReqType = 'UPDATE';
	}

	var myPost = {
		  'type' : myReqType,
		  'agent':'bower-plugin',
		  'agentVersion':'1.0',
		  'product':productName,
		  'productVer':productVer,
		  'projectName':projectName,
		  'projectVer':projectVer,
		  'token':confJson.apiKey,
		  'timeStamp':ts,
		  'diff':JSON.stringify(json)
	  }
	  //if both Project-Token and ProductToken send the Project-Token
	  if(projectToken){
		myPost.projectToken = projectToken;
	  }else if(productToken){
	  	myPost.productToken = productToken;
	  }

	  // Build the post string from an object
	  var post_data = querystring.stringify(myPost);
	  

	  cli.ok("Posting to " + reqHost + ":" + port)

	  // An object of options to indicate where to post to
	  var post_options = {
	      host: reqHost,
	      /*host: '10.0.0.11',*/
	      port: port,
	      path: '/agent',
	      method: 'POST',
	      headers: {
	          'Content-Type': 'application/x-www-form-urlencoded',
	          /*'Content-Length': post_data.length*/
	      }
	  };

	  var callback = function(res){
	  	  var str = [];
  		  res.on('data', function (chunk){
		    str += (chunk);
		    //TODO:draw post_req progress.
		  });

		  res.on('end', function(){
		  	//console.log(str)
		  	var resJson = JSON.parse(str);
  	        if(resJson.status == 1){
	      	  buildCallback(resJson);
	        }else{
  	      	  cli.error(JSON.stringify(resJson));
  	      	  process.exit(1);
	        }
		    // your code here if you want to use the results !
		  });
	  }

      // Set up the request
	  post_req = http.request(post_options, callback);

      if(isHttps){
      	  cli.info("Using HTTPS")
      	  post_options.headers = {
	          'Content-Type': 'application/x-www-form-urlencoded',
	          'Content-Length': post_data.length
	      }
		  post_req = https.request(post_options, callback);
      }

	  // post the data
	  post_req.write(post_data);
	  post_req.end();
}


var start = function(){
	var confJSON = readConfJson();
	var report = buildReport(confJSON);
	postJson(report,confJSON);
}

start();

