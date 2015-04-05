var fs = require('fs');
var cli = require('cli');
var postJSON = {
	dependencies:{}
};

var bowerDeps = {};
	
var buildReport = function(){
	try{
		bowerFile = JSON.parse(fs.readFileSync('./bower.json', 'utf8'));
	}catch(e){
		cli.error('Problem reading Bower.json, please check the file exists and is a valid JSON');
		return false;
	}

	try {
		postJSON.name = bowerFile.name;
		postJSON.version = bowerFile.version;
	}catch(e){
		cli.error('Problem reading Bower.json, please check that you added a NAME and VERSION to the bower.json file.');
		return false;
	}

	bowerDeps = bowerFile.dependencies;

	Object.keys(bowerDeps).forEach(function(key) {
		postJSON.dependencies[key] = bowerDeps[key];
	});

	console.log(postJSON)
}

buildReport();


var postJson = function(){
	cli.ok('Getting ready to post report to WhiteSource...');
	var origJson = JSON.parse(fs.readFileSync('./whitesource.report.json', 'utf8'));

	var isHttps = true;
	
	if(typeof(confJson.https) !== "undefined"){
		 isHttps = confJson.https;
	}
	
	var reqHost = (confJson.baseURL) ? confJson.baseURL : baseURL;
	var port = (confJson.port) ? confJson.port : "443";
	var productName = (confJson.productName) ? confJson.productName : modJson.name;
	var productVer = (confJson.productVersion) ? confJson.productVersion : modJson.version;
	var productToken = (confJson.productToken) ? confJson.productToken : "";
	var projectName = (confJson.projectName) ? confJson.projectName : modJson.name;
	var projectVer = (confJson.projectVer) ? confJson.projectVer : modJson.version;
	var projectToken = (confJson.projectToken) ? confJson.projectToken : "";
	var ts = new Date().valueOf();
	var post_req;

	if(!confJson.apiKey){
		cli.error('Cant find API Key, please make sure you input your whitesource API token in the whitesource.config file.');
		return false
	}

	
	if(projectToken && productToken){
		cli.error('Cant use both project Token & product Token please select use only one token,to fix this open the whitesource.config file and remove one of the tokens.');
		return false
	}

	var json = [{
		dependencies:modifiedJson.children,
		coordinates:{
        	"artifactId": modJson.name,
	        "version":modJson.version
    	}
	}]
	
	var checkPol = (modJson.checkPolicies) ? modJson.checkPolicies : true;
	var myReqType = ((checkPol && !checkPolSent) ? 'CHECK_POLICIES' : 'UPDATE');

	if(!checkPolEnabled){
		myReqType = 'UPDATE';
	}

	var myPost = {
		  'type' : myReqType,
		  'agent':'npm-plugin',
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

