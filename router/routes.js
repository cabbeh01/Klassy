//let objectId = require('mongodb').ObjectID;
const jwt = require('jsonwebtoken');
//const secret = require('./secret');
const bcrypt = require('bcryptjs');
const codeGen = require("../codegenerator.js");
const mail = require("../mail.js");
const valiInputLogin = require("../validationLogin.js");
const valiInputRegister = require("../validationRegister.js");
const valiInputCode = require("../validationCode.js");

module.exports = async function(app,io){
    
    //Main page
    app.get("/", auth, async function(req,res){
        
        try{
            if(app.currentGroup == "1" || app.currentGroup == "0"){
                
                user = await getUser(req,res);

                res.render('index',{title:"Home",layout:"loggedin", user:user});
            }
            else{
                res.render('index',{title:"Home"});
            }
        }
        catch(err){
            console.log(err);
            res.render('index',{title:"Home"});
        }
        
    });

    //Login
    app.get("/login",loggedinRedirector,function(req,res){
        res.render('login',{title:"Inlogging"});
    });

    app.post("/login",valiInputLogin, async function(req,res){

        try{
            let inEmail = req.body.email;
            let pass = req.body.password;
            
            if(!req.err){
                await app.users.findOne({"email": inEmail},function(err,data){
    
                    if(!(data == null)){
                        //console.log(data.password);
                        //console.log(pass);
                        if(data.verified){
                            bcrypt.compare(pass,data.password,function(err,succ){
        
                                console.log(err);
                                console.log(succ);
                                if(succ){
                                    
                                    const token = jwt.sign(data,process.env.PRIVATEKEY,{expiresIn:3600});
                                    res.cookie("token",token,{httpOnly:true, maxAge:(2 * 24 * 60 * 60 * 1000),sameSite: 'strict'});
            
                                    switch(data.group){
                                        case "0":
                                            res.redirect("/teacher");
                                            break;
                                        case "1":
                                            res.redirect("/pupil");
                                            break;
                                    }
                                }
                                else{
                                    res.render('login',{title:"Registrering", errmess:"<script>alertify.error('Det går inte att logga in');</script>", email:req.body.email});
                                }
                            });
                        }
                        else{
                            res.render('login',{title:"Registrering", errmess:"<script>alertify.error('Det går inte att logga in');</script>", email:req.body.email});
                        }
                        
                    }
                    else{
                        res.render('login',{title:"Registrering", errmess:"<script>alertify.error('Det går inte att logga in');</script>", email:req.body.email});
                    }
                });
            }
            else{
                //console.log(req.err);
                res.render('login',{title:"Registrering", errmess:"<script>alertify.error('Det går inte att logga in');</script>", email:req.body.email});
            }
            
        }
        catch(err){
            res.render('login',{title:"Registrering", errmess:"<script>alertify.error('Det går inte att logga in');</script>", email:req.body.email});
        }
        
        
    });


    //Register
    app.get("/register",loggedinRedirector,function(req,res){
        res.render('register',{title:"Registrering"});
    });

    app.post("/register",valiInputRegister,async function(req,res){
        if(!req.err){
            bcrypt.hash(req.body.password,12,async function(err,hash){
                let inEmail = req.body.email;
                
                    await app.users.findOne({"email": inEmail},async function(err,data){
                    
                        if(data == null){
                            
                            req.body.password = hash;
                            delete req.body.repassword;
                            req.body.verified =  false;
                            let code = codeGen(26);
                            req.body.verifyCode = code;
                            await app.users.insertOne(req.body,function(err,result){
                                
                                //console.log(err);
                                //console.log(result.insertedId);
                                mail(req.body.email,"Verify account","Var vänligen och verifiera dig!","http://localhost:2380/confirm/"+result.ops[0]._id+"/"+code);
                                
                            });
                            res.render('login',{title:"Registrering avklarad", errmess:"<script>alertify.warning('Du är nu registrerad, ett mail har skickats till din inkorg. Vänligen bekräfta ditt konto!');</script>", name: req.body.name, class: req.body.class, email: req.body.email});
                        }
                        else{
                            res.render('register',{title:"Registrering", errmess:"<script>alertify.error('Det går inte att registrera');</script>", name: req.body.name, class: req.body.class, email: req.body.email});
                        }
                        
                    });
            });

        }
        else{
            //console.log(req.err);
            res.render('register',{title:"Registrering", errmess:"<script>alertify.error('Det går inte att registrera');</script>", name: req.body.name, class: req.body.class, email: req.body.email});
        }
        //res.send(req.body.group);
    });

    //Confirmation after registation
    app.get("/confirm/:id/:code", async function(req,res){
        try{
            let id = req.params.id;
            await app.users.findOne({"_id": app.objID(id)},async function(err,data){
                //console.log(data);
                try{
                    if(data.verifyCode == req.params.code){
                        data.verified = true;
                        await app.users.updateOne({"_id":app.objID(id)},{$set:{verified:true}},function(err){
                            console.log(err);
                        });
                        res.render("index",{title:"Verifierad",mess:"<script>alertify.success('Det är nu verifierad!');</script>"});
                    }
                    else{
                        res.render("index",{title:"Det gick inte att verifiera",mess:"<script>alertify.error('Det gick inte att verifiera');</script>"});
                    }
                }
                catch{
                    res.render("index",{title:"Det gick inte att verifiera",mess:"<script>alertify.error('Det gick inte att verifiera');</script>"});
                }
                
            });
            
        }
        catch(err){
            //console.log(err);
            res.redirect("/");
        }
    });
    
    //Sessions
    app.get("/session",verifiedAcc,function(req,res){
        res.redirect("/");
    });

    //Pupil or guest connecting to a session
    app.get("/session/:id",verifiedAcc,valiInputCode,async function(req,res){
        try{
            if(!req.err){
                let user = await getUser(req,res);
                let lesson = await getLesson(req.params.id);
    
    
                console.log(lesson);
                if(lesson){
                    res.render("session",{title:"Elev inloggad | "+ req.params.id, code:req.params.id, info:lesson.info,
                    io:`
                    <script>
                    var socket = io("/${req.params.id}");
                    socket.on('connect', function () {
                        socket.emit('user',${JSON.stringify(user)});
                        socket.emit('hi');
                    });
        
                    socket.on('disconnect', function () {
                    socket.emit(${JSON.stringify(user)});
                    });
                    </script>
                    `,
                    user:user,layout:"loggedin"})
                }
                else{
                    let user = await getUser(req,res);
                    res.render("pupil", {title:"Elev inloggad", erress:"<script>alertify.error('Finns inget lektion med den nyckeln');</script>",user:user,layout:"loggedin"})
                }
                
            }
            else{
                let user = await getUser(req,res);
                res.render("pupil", {title:"Elev inloggad", erress:"<script>alertify.error('Finns inget lektion med den nyckeln');</script>",user:user,layout:"loggedin"})
            }
            
        }
        catch(err){
            let user = await getUser(req,res);
            res.render("pupil", {title:"Elev inloggad", erress:"<script>alertify.error('Finns inget lektion med den nyckeln');</script>",user:user,layout:"loggedin"})
            console.log(err);
        }
        

        //user = await app.users.findOne()
        //console.log(user);
        
    });


    app.post("/session",verifiedAcc,async function(req,res){
        res.redirect("/session/" + req.body.code);
    });

    





    
    //Lärare
    app.get("/teacher",verifiedAcc,auth,async function(req,res){
        user = await getUser(req,res);
        if(app.currentGroup == "0"){
            res.render("teacher",{title:"Lärare inloggad",layout:"loggedin", user:user});
        }
        else if(app.currentGroup == "1"){
            res.redirect("/pupil");
        }
        else{
            res.redirect("/login");
        }
    });

    
    //Teacher preparing a lesson
    app.post("/preplesson", function(req,res){
        res.render("preplesson",{title:"Lektion: ",layout:"loggedin",user:user});
    });
    
    //Teacher starting a session
    app.post("/startlesson", function(req,res){
        console.log(req.body.info);
        const code = codeGen(6);
        app.info = req.body.info;
        setLesson(req,res,code,user);
        res.redirect("/lesson/" + code);
    });


    app.get("/lesson/:id",verifiedAcc, async function(req,res){
        const c = req.params.id;
        const lessInfo = app.info;
        const socket = io.of('/' + c);
        
        socket.on('connection', function(socket){
            
            socket.on('user', function (usr) { 
                console.log(usr.name + " connected on code: " + c);
            });
            socket.on('disconnect', function (usr) { 
                console.log(usr.name + " disconnected from code: " + c);
            });
            //res.render("lesson",{title:"Lektion: " + c,code:c,layout:"loggedin",user:user})
        });

        res.render("lesson",{title:"Lektion: " + c,code:c,layout:"loggedin",user:user, lessinf:lessInfo})
    });









    io.on('connection', (socket) => {

        console.log(socket.id + ' uppkopplad mot servern')
        socket.room = 'default';
        socket.join('default')
        socket.isOwner = false;
    
        //---------------------------------Läraren skapar sina rum här---------------------------------
        socket.on('create_room', (data) => {
            try {
                
            }
            catch (error) {
                
            }
    
        })
    
        //---------------------------------Eleverna joinar dem här---------------------------------
        socket.on('join_room', (data) => {
            try {
                
    
            }
            catch (error) {
                console.error(error);
                socket.emit('client_error', "Kunde inte joina rummet.");
            }
        })
        //---------------------------------Lämna rummet---------------------------------
        socket.on('left_room', (data) => {
            try {
                
            }
            catch (error) {
               
            }
        })
       
    
        //---------------------------------Stänger webbläsaren---------------------------------
        socket.on('disconnect', function () {
            try {
                console.log(socket.id + ' disconnectar från servern')
            }
            catch (error) {
                console.error(error);
            }

        });
    })



    //Elev
    app.get("/pupil",verifiedAcc,auth,async function(req,res){
        user = await getUser(req,res);
        if(app.currentGroup == "1"){
            res.render("pupil",{title:"Elev inloggad",layout:"loggedin",user:user});
        }
        else if(app.currentGroup == "0"){
            res.redirect("/teacher");
        }
        else{
            res.redirect("/login");
        }
    });

    //Logout
    app.get("/logout",function(req,res){
        app.currentGroup = undefined;
        res.clearCookie("token");
        res.redirect("/");
    });

    async function verifiedAcc(req,res,next){
        try{
            user = await getUser(req,res);
            if(!user.verified){
                res.render('login',{title:"Ej verifierad", errmess:"Du måste verifiera ditt konto vänligen kolla din inkorg"});
            }
            else{
                next();
            }
        }
        catch{
            res.redirect("/");
        }
        
    }

    function auth(req,res,next){
        
        try{
            let token = req.cookies.token;
        
            if(!(token === undefined)){
                jwt.verify(token,process.env.PRIVATEKEY, async function(err,decoded){
                    if(decoded !== undefined){
                        await app.users.findOne({"email": decoded.email},function(err,data){
                            
                            if(!(data == null)){
                                //console.log(data.group);
                                if(data.password == decoded.password){
                                    app.currentGroup = data.group;
                                    next();
                                }
                                else{
                                    app.currentGroup = undefined;
                                    next();
                                }
                            }
                            
                        });
                    }
                });
            }
            else{
                res.clearCookie("token");
                app.currentGroup = undefined;
                next();
            }
        }
        catch(err){
            console.log(err);
        }
        
        
    }

    function loggedinRedirector(req,res,next){
        try{
            if(app.currentGroup == "0"){
                res.redirect("/teacher");
            }
            else if(app.currentGroup == "1"){
                res.redirect("/pupil");
            }
            else{
                next();
            }
        }
        catch(err){
            console.log(err);
        }
    }


    function verifyToken(req,res){
        try{
            return new Promise(function(resolve,reject){
                let token = req.cookies.token;
                jwt.verify(token,process.env.PRIVATEKEY, function(err,decoded){
                    if(decoded !== undefined){
                        resolve(decoded)
                    }
                    else{
                        reject(0)
                    }
                });
            });
        }
        catch(err){
            console.log(err);
        }
        
    }


    async function getUser(req,res){

        try{
            let decodedToken = await verifyToken(req,res);

            return new Promise(function(resolve,reject){
                app.users.findOne({"email": decodedToken.email},function(err,data){        
                    if(!(data == null)){
                        resolve(data);
                    }
                    else{
                        reject(0);
                    }
                });
            });
        }
        catch(err){
            console.log(err);
        }
        
        
    }

    
    async function setLesson(req,res,code,owner,bil){

        var lesson = {key:code, info:req.body.info,bilagor:bil, ownerId:owner._id, listUsers:""};
        console.log(lesson);
        await app.lessons.findOne({"key": code},async function(err,data){
            var lesson = {key:code, info:req.body.info, ownerId:owner._id}
            if(data == null){
                await app.lessons.insertOne(lesson,function(err,result){
                    if(err){
                        console.log(err);
                    }
                });
            }
            else{
                setLesson(req,res,codeGen(6),lesson.ownerId,lesson.bil,lesson.listUsers);
            }
            
        });
    }

    function getLesson(code){

        try{
            return new Promise(async function(resolve,reject){
                await app.lessons.findOne({"key": code},async function(err,data){
                    //var lesson = {key:code, info:req.body.info, ownerId:owner._id}
                    if(err){
                        reject(null)
                    }
                    resolve(data);
                });
            });
        }
        catch(err){
            console.log(err);
        }
    }
    
    
    
}