// referenciando as bibliotecas que serão usadas
var express = require('express');
var app = express();
var bodyParser = require('body-parser');
var jwt = require('jsonwebtoken');
var secretKey = "MySuperSecretKey"; //usada para gerar o token de acesso do usuário

//Database connect mongolab
var mongoose = require('mongoose');
mongoose.connect('mongodb://root:root@ds031845.mlab.com:31845/blog-vue', function(err){
	if(err){
		console.error("error! " + err)
	}
});

// bodyparser obtem os dados por uma requisição JSON
app.use(bodyParser.urlencoded({ extends: true}));
app.use(bodyParser.json());

// load model post e user
var Post = require('./model/post');
var User = require('./model/user');

//express se comportando como uma API
var router = express.Router();

//configura o diretório estatico para entrega de dados ao requisitante
// __dirname fornece o caminho até o arquivo server.js
app.use('/', express.static(__dirname+'/'));

//middleware: run in all requests
//ex de saida do console.warn POST /login with {"login":"foo","password":"bar"}
router.use(function(req, res, next){
	console.warn(req.method + " " + req.url + " with " + JSON.stringify(req.body));
	next();
});

//middleware: auth
var auth = function (req, res, next) {
	var token = req.body.token || req.query.token || req.headers['x-access-token'];
	if (token) {
		jwt.verify(token, secretKey, function (err, decoded) {
			if (err) {
				return res.status(403).send({
					success: false,
					message: 'Access denied'
				});
			} else {
				req.decoded = decoded;
				next();
			}
		});
	}
	else {
		return res.status(403).send({
			success: false,
			message: 'Access denied'
		});
	}
}

//Simple GET / test
router.get('/', function(req, res){
	res.json({ message: 'hello world!'});
});

//methods GET e POST pars o User
router.route('/users')
.get(auth, function (req, res) {
	User.find(function (err, users) {
		if (err)
			res.send(err);
		res.json(users);
	});
})
.post(function (req, res) {
	var user = new User();
	user.name = req.body.name;
	user.login = req.body.login;
	user.password = req.body.password;
	user.save(function (err) {
		if (err)
			res.send(err);
		res.json(user);
	})
});


//method de verificar login se já existe se não cria um novo
router.route('/login').post(function (req, res) {
	if (req.body.isNew) {
		User.findOne({ login: req.body.login }, 'name').exec(function (err, user) {
			if (err) res.send(err);
			if (user != null) {
				res.status(400).send('Login Existente');
			}
			else {
				var newUser = new User();
				newUser.name = req.body.name;
				newUser.login = req.body.login;
				newUser.password = req.body.password;
				newUser.save(function (err) {
					if (err) res.send(err);
					var token = jwt.sign(newUser, secretKey, {
						expiresIn: "1 day"
					});
					res.json({ user: newUser, token: token });
				});
			}
		});
	} else {
		User.findOne({ login: req.body.login,
			password: req.body.password }, 'name')
		.exec(function (err, user) {
			if (err) res.send(err);
			if (user != null) {
				var token = jwt.sign(user, secretKey, {
					expiresIn: "1 day"
				});
				res.json({ user: user, token: token });
			}else{
				res.status(400).send('Login/Senha incorretos');
			}
		});
	}
});


//verificação do Post e criando os methods POST e DELETE
router.route('/posts/:post_id?')
.get(function (req, res) {
	Post
	.find()
	.sort([['date', 'descending']])
	.populate('user', 'name')
	.exec(function (err, posts) {
		if (err)
			res.send(err);
		res.json(posts);
	});
})
.post(auth, function (req, res) {
	var post = new Post();
	post.title = req.body.title;
	post.text = req.body.text;
	post.user = req.body.user._id;
	if (post.title==null)
		res.status(400).send('Título não pode ser nulo');
	post.save(function (err) {
		if (err)
			res.send(err);
		res.json(post);
	});
})
.delete(auth, function (req, res) {
	Post.remove({
		_id: req.params.post_id
	}, function(err, post) {
		if (err)
			res.send(err);
		res.json({ message: 'Successfully deleted' });
	});
});


//apostando api para a url /api
app.use('/api', router);
//start server - port
var port = process.env.PORT || 8080;
app.listen(port);
console.log('Listen: ' + port);

