const Hapi = require('@hapi/hapi');
const Qs = require('qs');
const redis = require('redis');
const { promisify } = require("util");


const redisClient = redis.createClient(6379);


 redisClient.on("error", function (err) {
    console.error("Redis error.", err);
  });

const getAsync = promisify(redisClient.get).bind(redisClient);
const setAsync = promisify(redisClient.set).bind(redisClient);
const delAsync = promisify(redisClient.del).bind(redisClient);


//E.g. for delete there can be multiple routes - one for single delete and other for multiple deletes

const database_roles = ['customer','admin','marketing_executive','customer_executive','nutritionist']
const database_resources = ['marketing','operations','reports','customer_profiles','customer_support_tickets']
const database_role_actions = {
	'customer':{
		'marketing':[''],
		'operations':[''],
		'reports':['view_own','edit_own'],
		'customer_profiles':['view_own','edit_own','delete_own'],
		'customer_support_tickets':['view_own']
	},
	'admin':{
		'marketing':['all'],
		'operations':['all'],
		'reports':['all'],
		'customer_profiles':['all'],
		'customer_support_tickets':['all']
	},
	'marketing_executive':{
		'marketing':['view_many','edit_many','edit_own','create_many'],
		'operations':[''],
		'reports':[''],
		'customer_profiles':['view_many'],
		'customer_support_tickets':['view_many']
	},
	'customer_executive':{
		'marketing':[''],
		'operations':[''],
		'reports':[''],
		'customer_profiles':[''],
		'customer_support_tickets':['view_many','edit_many','edit_own']
	},
	'nutritionist':{
		'marketing':[''],
		'operations':[''],
		'reports':['view_many','edit_many','edit_own','delete_many'],
		'customer_profiles':[''],
		'customer_support_tickets':['']
	}
}

const server = Hapi.server({
    port: 3000,
    host: 'localhost',
    query: {
        parser: (query) => Qs.parse(query)
    }
});

const isAuthorized = async ({session_id,resource_name,action_performed})=>{
	var promiseFunction = new Promise((resolve, reject)=>{
		var user_role;
		var cachedData = getAsync(session_id).then((cachedData)=>{
    	if (cachedData != null) {
      	user_role = JSON.parse(cachedData)['role'];

      	//makes database queries to find out the actions allowed for the given role
      	permitted_user_actions = database_role_actions[user_role][resource_name];
      	if(permitted_user_actions.includes(action_performed) || permitted_user_actions.includes('all')){
      		resolve(true);
      	}
      		resolve(false);
    	} else {
    		resolve(false);
    }
	}).catch((error)=>{
		console.log(error);
		resolve(false);
	});
	});

	var resp = await promiseFunction;
	return resp;

 }

server.route({
    method: 'GET',
    path: '/',
    handler: (request, h) => {
    	console.log(request.server.info.id);

        return "Hello World"
    }
});

server.route({
    method: 'GET',
    path: '/login',
    handler: (request, h) => {
    	var role = "admin";
    	const user_data = {
    		"role":role
    	};
    	setAsync(request.server.info.id, JSON.stringify(user_data)).then((data)=>{

    		console.log("added to cache "+request.server.info.id)
    	})
    	.catch((error)=>{
    		console.log("error occurred adding to cache",error)
    	});
    	return "logged in"
        
    }
});


server.route({
    method: 'GET',
    path: '/get-users',
    handler: async (request,h) => {
    		if(await isAuthorized({"session_id":request.server.info.id,"resource_name":"customer_profiles","action_performed":"view_many"}))
    		{
    			//call route handler
    			return "got users";
    		}
        	return "unauthorized access";
        }
});

server.route({
    method: 'GET',
    path: '/delete-user',
    handler: async (request, h) => {
    	if(await isAuthorized({"session_id":request.server.info.id,"resource_name":"customer_profiles","action_performed":"delete_own"}))
    		{
    			//call route handler
    			return "deleted user";
    		}
        	return "unauthorized access";
    }
});

server.route({
    method: 'GET',
    path: '/delete-users',
    handler: async (request, h) => {
    	if(await isAuthorized({"session_id":request.server.info.id,"resource_name":"customer_profiles","action_performed":"delete_many"}))
    		{
    			//call route handler
    			return "deleted multiple users";
    		}
        	return "unauthorized access";
    }
});

server.route({
    method: 'GET',
    path: '/edit-report',
    handler: async (request, h) => {
    	if(await isAuthorized({"session_id":request.server.info.id,"resource_name":"reports","action_performed":"edit_own"}))
    		{
    			//call route handler
    			return "edited report";
    		}
        	return "unauthorized access";
    }
});

server.route({
    method: 'GET',
    path: '/new-marketing-campaign',
    handler: async (request, h) => {
    	if(await isAuthorized({"session_id":request.server.info.id,"resource_name":"marketing","action_performed":"create_many"}))
    		{
    			//call route handler
    			return "created new campaign"
    		}
        	return "unauthorized access";
    }
});

server.route({
    method: 'GET',
    path: '/delete-marketing-campaign',
    handler: async (request, h) => {
    	if(await isAuthorized({"session_id":request.server.info.id,"resource_name":"marketing","action_performed":"delete_own"}))
    		{
    			//call route handler
    			return "deleted new campaign"
    		}
        	return "unauthorized access";
    }
});

server.route({
    method: 'GET',
    path: '/logout',
    handler:  (request, h) => {
    	delAsync(request.server.info.id).then((data)=>{
    		console.log("deleted from cache")
    	})
    	.catch((error)=>{
    		console.log("error deleting from cache");
    	});
    	return "logged out"
    }
});


const init = async () => {

    await server.start();
    console.log('Server running on %s', server.info.uri);
};

process.on('unhandledRejection', (err) => {

    console.log(err);
    process.exit(1);
});

init();