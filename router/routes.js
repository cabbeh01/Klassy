const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const codeGen = require("../codegenerator.js");
const mail = require("../mail.js");
const valiInputLogin = require("../validationLogin.js");
const valiInputRegister = require("../validationRegister.js");
const valiInputCode = require("../validationCode.js");
const valiInputRubrik = require("../validationRubrik.js")

module.exports = async function(app,io){
    
    //Startsida
    app.get("/", auth, async function(req,res){
        
        try{
            //Kontrollerar ifall användaren är inloggad
            if(app.currentGroup == "1" || app.currentGroup == "0"){
                //Hämtar användar datan från mongoDB databas
                user = await getUser(req,res);
                res.render('index',{title:"Home",layout:"loggedin", user:user});
            }
            else{
                res.render('index',{title:"Home"});
            }
        }
        catch(err){
            res.render('index',{title:"Home"});
        }
        
    });

    //GET- Login detta visas när användaren kommer till login
    app.get("/login",loggedinRedirector,function(req,res){
        res.render('login',{title:"Inlogging"});
    });

    //När användaren skrivit in sina inloggningsuppgifter kommer de att berabetas
    //Först valideras inmatningen
    app.post("/login",valiInputLogin, async function(req,res){

        try{
            //Lägger email och lösen i separata varibler så det blir lätt att komma åt
            let inEmail = req.body.email;
            let pass = req.body.password;
            
            //Om inget fel har uppstått
            if(!req.err){
                
                //Leta upp eposten på databasen
                await app.users.findOne({"email": inEmail},function(err,data){
    
                    //Hittar den en användare som har eposten
                    if(!(data == null)){
                       
                        //Kollar ifall användaren är verifierad och är den det så fortsätter inloggningen
                        if(data.verified){

                            //Lösenorden jämförs
                            bcrypt.compare(pass,data.password,function(err,succ){
        
                                //Fungerar allt som det ska och lösenorden stämmer överens
                                if(succ){

                                    //Skapar en token som ska lagras i cookien så att användaren kan gå mellan routes utan att behöva
                                    //logga in igen. Detta har jag löst med att använda JWT (Json Web Token) detta bibliotek gör att
                                    //man kan lagra information krypterat. Samt sätta en ålder på det
                                    const token = jwt.sign(data,process.env.PRIVATEKEY,{expiresIn:"1 day"});

                                    //Skapar en cookie som heter token och lägger in den krypterade informationen i kakan med en maxålder.
                                    //httponly gör att kakan endast kan kommas åt från servern och inte från separata scripts från clienten
                                    //sameSite gör att kakan begränsas till samma domän som man är på
                                    res.cookie("token",token,{httpOnly:true, maxAge:(2 * 24 * 60 * 60 * 1000),sameSite: 'strict'});
            
                                    //Beroende på vilken behörighetsgrupp man tillhör så redirectar man till olika saker
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
                                    res.render('login',{title:"Registrering",
                                    errmess:"<script>alertify.error('Det går inte att logga in');</script>", email:req.body.email});
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
                res.render('login',{title:"Registrering", errmess:"<script>alertify.error('Det går inte att logga in');</script>", email:req.body.email});
            }
            
        }
        catch(err){
            res.render('login',{title:"Registrering", errmess:"<script>alertify.error('Det går inte att logga in');</script>", email:req.body.email});
        }
        
        
    });


    //Registrering
    //GET-route som läser in html för användaren med hjälp av ett bibliotek som heter handelbars
    app.get("/register",loggedinRedirector,function(req,res){
        res.render('register',{title:"Registrering"});
    });

    //När användaren klickar på en submitknapp i ett formulär hamnar hen i en postfunktion
    //När användaren registrerat sig kontrolleras först inmatningen i en middleware valiInputRegister
    app.post("/register",valiInputRegister,async function(req,res){
        try{

            //Kontrollerar så att inte problem har uppstått
            if(!req.err){
                //Jag användar mig av ett bibliotek som heter Bcrypt. Det gör jag för att säkerställa att
                //användarens lösenord kan förvaras säkert på databasen. Varje lösenord går igenom en process
                //där datorn lägger och slumpar runt teckena. Detta kommer göras 12 gånger. En hash kan inte knäckas
                //utan kan bara jämföras med en annan hash för att se ifall de är korrekta.
                bcrypt.hash(req.body.password,12,async function(err,hash){
                    
                    //Hämtar email
                    let inEmail = req.body.email;
                    
                        //Tar reda på ifall emailen finns i databasen
                        await app.users.findOne({"email": inEmail},async function(err,data){
                        
                            //Om den inte finns
                            if(data == null){
                                //Sätter vi hashen till användarens lösenord
                                req.body.password = hash;

                                //Tar bort repassword i objektet som är i klartext
                                delete req.body.repassword;

                                //Sätter användaren till ej verifierad då jag använder mig av tvåstegsverifiering
                                req.body.verified =  false;

                                //Genererar en verifieringskod
                                let code = codeGen(26);

                                //Lägger in verifieringskod i objektet
                                req.body.verifyCode = code;

                                //Lägger till användaren i användardatabasen
                                await app.users.insertOne(req.body,function(err,result){
                                    
                                    //Skickar ett bekräftelsemail mail till användarens-mail.
                                    mail(req.body.email,"Verify account","Var vänligen och verifiera dig!","http://localhost:2380/confirm/"+result.ops[0]._id+"/"+code);
                                });
                                
                                //Skickar en html sida till användaren att registrering gick igenom och berättar för hen att hen ska verifiera sitt konto med sin mail
                                res.render('login',{title:"Registrering avklarad", 
                                errmess:"<script>alertify.warning('Du är nu registrerad, ett mail har skickats till din inkorg. Vänligen bekräfta ditt konto!');</script>", 
                                name: req.body.name, class: req.body.class, email: req.body.email});
                            }
                            else{
                                
                                //Det gick inte registrera html, fast behåller de inmatade värdena förutom lösenordet
                                res.render('register',{title:"Registrering", errmess:"<script>alertify.error('Det går inte att registrera');</script>", name: req.body.name, 
                                class: req.body.class, email: req.body.email});
                            }
                            
                        });
                });
    
            }
            else{
                //Felmeddelande skickas
                res.render('register',{title:"Registrering", errmess:"<script>alertify.error('Det går inte att registrera');</script>", name: req.body.name, 
                class: req.body.class, email: req.body.email});
            }
        }
        catch{
            //Skulle det inte alls fungera så startas routen om
            res.redirect("/register");
        }
    });

    //Tvåstegsverifiering efter att man har registrerat sig
    app.get("/confirm/:id/:code", async function(req,res){
        try{
            //När anändaren registrerar sig skickas en länk i detta formatet 
            //Exempel  http://localhost:2380/confirm/hdjksahdsuai/djfldsfhsduflidshfsdflsd
            //                                          (id)                (code)
            
            //Hämtar id:et som följde med i epost-meddelandet
            let id = req.params.id;
            
            //Letar upp användaren med id:et
            await app.users.findOne({"_id": app.objID(id)},async function(err,data){
                
                try{
                    //Om den inte är verifierad
                    if(!data.verified){
                        
                        //Kontrollerar så att verifieringskoderna stämmer överens
                        if(data.verifyCode == req.params.code){
                            //Ändrar så att användaren är veriferad
                            data.verified = true;

                            //Uppdaterar användaren på databasen
                            await app.users.updateOne({"_id":app.objID(id)},{$set:{verified:true}},function(err){
                                
                            });

                            //Meddelar användaren att hen är veriferad
                            res.render("index",{title:"Verifierad",mess:"<script>alertify.success('Det är nu verifierad!');</script>"});
                        }
                        //Sedan massa felmeddelande ifall det inte fungerade
                        else{
                            res.render("index",{title:"Det gick inte att verifiera",mess:"<script>alertify.error('Det gick inte att verifiera');</script>"});
                        }
                    }
                    else{
                        res.render("index",{title:"Det gick inte att verifiera",mess:"<script>alertify.warning('Du är reda verifierad!');</script>"});
                    }
                    
                }
                catch{
                    res.render("index",{title:"Det gick inte att verifiera",mess:"<script>alertify.error('Det gick inte att verifiera');</script>"});
                }
                
            });
            
        }
        catch(err){
            res.redirect("/");
        }
    });
    



    //Elevens start route när hen är inloggad
    app.get("/pupil",verifiedAcc,auth,async function(req,res){
        
        //Hämtar information om användaren
        user = await getUser(req,res);

        //Är användaren en elev
        if(app.currentGroup == "1"){
            //Renderar vi vyn för eleven
            res.render("pupil",{title:"Elev inloggad",layout:"loggedin",user:user});
        }
        //Om inte och istället är en lärare skickar vi
        //användaren dit
        else if(app.currentGroup == "0"){
            res.redirect("/teacher");
        }
        //Inget av dem så skickar vi användaren till loginsidan
        else{
            res.redirect("/login");
        }
    });

    //Session för eleverna som ska koppla upp sig mot en lektion
    //I detta fallet kan inte en elev koppla upp sig då hen sakar en sessions id
    //Därför redirectar jag eleven till startsidan
    app.get("/session",verifiedAcc,function(req,res){
        res.redirect("/");
    });

    //Elever kopplar upp sig mot en lektion med en specifik nyckel
    app.get("/session/:id",verifiedAcc,valiInputCode,async function(req,res){
        try{
            //Har ett problem inte uppstått annars skrivs felen ut
            if(!req.err){

                //Hämtar information om användaren i detta fallet eleven
                let user = await getUser(req,res);

                //Hämtar information om lektionen. som t.ex. info, rubrik, bilagor
                let lesson = await getLesson(req.params.id);
    
                //Finns lektionen så ska den renderas ut för användaren
                if(lesson){
                    res.render("session",{title:"Elev inloggad | "+ req.params.id, code:req.params.id, info:lesson.info, rubrik:lesson.rubrik,
                    
                    //När htmlkoden renderas ut skickar jag även med klientkod så att jag kan få socket.io fungera
                    io:`
                    <script>
                    let userID = "${user._id}";                     //Lagrar användarID i en variable
                    let userName = "${user.name}";                  //Lagrar användarNamnet i en variabel 
                    
                    const socket = io('/${lesson.key}');            //Sätter upp en session som ligger i en sessionsroute som 
                                                                    //består av /(koden)
                    
                    socket.on('pupil', (data) => {                  //Vid paketmottagning vid namnet pupil ska datan kontrolleras
                                                                    //Är där data ska den kontrollera så att användareID == användarensID
                                                                    //Stämmer det ska layouten för användaren resettas till att den behöver hjälp
                        if(data){
                            if(data.userID == userID){
                                document.getElementById("helpbutton").style.backgroundColor = "#e1cc67";
                                document.getElementById("helpbutton").style.borderColor = "#b8a545";
                                document.getElementById("helpbutton").innerHTML = "Hjälp";
                                want = 0;
                            }
                        }
                    });

                    //Variabel som indikerar att eleven behöver hjälp
                    let want = 0;

                    //Om användaren behöver hjälp ändras knappen beroende på vilken status
                    //want varibeln har

                    function help(){
                        if(want == 1){
                            document.getElementById("helpbutton").style.backgroundColor = "#e1cc67";
                            document.getElementById("helpbutton").style.borderColor = "#b8a545";
                            document.getElementById("helpbutton").innerHTML = "Hjälp";
                            want = 0;
                        }
                        else{
                            console.log("Jag behöver hjälp");
                            document.getElementById("helpbutton").style.backgroundColor = "#e16767";
                            document.getElementById("helpbutton").style.borderColor = "#b84545";
                            document.getElementById("helpbutton").innerHTML = "Avbryt";
                            want = 1
                        }
                        

                        //Sedan skickas statusen till pupilchange och där lärarens client lyssnar på detta och hanterar
                        //situationen där ifrån
                        socket.emit("pupilchange",{userID,userName,status:want});
                        console.log(want);
                    }
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
            
        }

    });


    app.post("/session",verifiedAcc,valiInputCode,async function(req,res){
        
        //Kollar så att koden är giltlig annars byt params till unknown
        //Detta gör för att inte kunna få felmeddelande så man hamnar i en annan site
        if(!req.err){
            res.redirect("/session/" + req.body.code);
        }
        else{
            res.redirect("/session/" + "unknown");
        }
    });

    





    
    //Lärare
    app.get("/teacher",verifiedAcc,teacherOnly,auth, async function(req,res){
        let user = await getUser(req,res);
        res.render("teacher",{title:"Lärare inloggad",layout:"loggedin", user:user});
    });

    
    //Lärare förbereder en lektion
    app.post("/preplesson",verifiedAcc,valiInputRubrik,teacherOnly, function(req,res){
       
        res.render("preplesson",{title:"Lektion: ",layout:"loggedin",user:user, action:"/startlesson",button:"Skapa lektion"});
    });

    

    app.get("/preplesson/:id",verifiedAcc,teacherOnly, async function(req,res){
        try{
            code = req.params.id;
            let lesson = await getLesson(code);
            res.render("preplesson",{title:"Redigerar " + lesson.rubrik,rubrik:lesson.rubrik, info:lesson.info, layout:"loggedin",user:user,action:"/updatelesson", oid:lesson._id, button:"Uppdatera lektionen"});
        }
        catch(err){
           res.redirect("lessons");
        }
    });
    app.post("/updatelesson",verifiedAcc,valiInputRubrik,teacherOnly, async function(req,res){
        await updateLesson(req.body);
        ls = await listLessons(user);
        res.redirect("/teacher/lessons");
    });
    //Lärare startar en lektion
    app.post("/startlesson",verifiedAcc,teacherOnly, function(req,res){
        const code = codeGen(6);
        setLesson(req,res,code,user);
        res.redirect("/teacher/lesson/" + code);
    });


    app.get("/teacher/lessons",verifiedAcc,valiInputRubrik,teacherOnly, async function(req,res){
        try{
            user = await getUser(req,res);
            ls = await listLessons(user);
            if(ls != ``){
                res.render("lessons",{lessons:ls, title:"Lektioner ",layout:"loggedin",user:user});
            }
            else{
                res.render("lessons",{lessons:"Det finns inga lektioner", title:"Lektioner ",layout:"loggedin",user:user});
            }
        }
        catch{
            res.redirect("/teacher");
        }
    });






    app.get("/teacher/lesson/:id",verifiedAcc,teacherOnly, async function(req,res){
        try{
            const c = req.params.id;
            let lesson = await getLesson(c);
            
            
            const lesNet = io.of('/'+c);
            lesNet.on('connection', function(socket){
                
                socket.on('pupilchange', function(data){
                    lesNet.emit('teacher', data);
                });
                socket.on('helpdone', function(data){
                    lesNet.emit('pupil', data);
                });
            });
            
    
            res.render("lesson",{title:"Lektion: " + c,code:c,layout:"loggedin",user:user, lessinf:lesson.info, rubrik:lesson.rubrik,
            io:`
                <script>
                    let users = [];
                    
                    const socket = io('/${lesson.key}');
                    
                    socket.on('teacher', (data) => {
                        if(data.status != 0){
                            users.push(data);
                        }
                        console.log(users);
                        users = users.filter(function(x){

                            if(x.userID.toString() == data.userID.toString()){
                                
                                if(data.status == 0){
                                    return false;
                                }
                                
                            }
                            return true;
                        });

                        drawTable();
                        
                    });
                    
                    function drawTable(){
                        let draw = "";
                        
                        users.forEach(function(element){
                            console.log(element);
                            draw += template(element.userName.toString());
                        });
                        
                        document.getElementById("list").innerHTML = draw;
                    }
                    
                    function template(name){
                        return "<li>"+ name +"</li>";
                    }

                    function lost(){
                        let user = users[0];
                        users.shift();
                        socket.emit("helpdone",user);
                        drawTable();
                    }
                </script>
            `});
        }
        catch(err){
            res.redirect("/teacher");
        }
        
    });



    app.get("/teacher/removeless/:id",verifiedAcc,teacherOnly, async function(req,res){
        try{
            let code = req.params.id;
        
            let lesson = await getLesson(code);
            res.render("removeless",{title:"Bekräfta bortagning av lektionen " + lesson.rubrik,key:code,lesson:lesson.rubrik,layout:"loggedin",user:user, lessinf:lesson.info, rubrik:lesson.rubrik});
        }
        catch{
            res.render("lessons", {title:"Elev inloggad", errmess:"<script>alertify.error('Det gick inte hitta lektionen');</script>",user:user,layout:"loggedin"});
        }

        
       
    });

    app.post("/teacher/removeless/confirm",verifiedAcc,teacherOnly, async function(req,res){
        
        try{
            let user = await getUser(req,res);
            let lesson = await getLesson(req.body.key);
    
            if(lesson.ownerId.toString() == user._id.toString()){
                if(removeLesson(req.body.key)){
                    res.redirect("/teacher/lessons");
                    
                }
                else{
    
                    res.render("lessons", {title:"Elev inloggad", errmess:"<script>alertify.error('Det gick inte ta bort lektionen');</script>",user:user,layout:"loggedin"});
                }
            }
            else{
                res.render("lessons", {title:"Elev inloggad", errmess:"<script>alertify.error('Det gick inte ta bort lektionen');</script>",user:user,layout:"loggedin"});
            }
        }
        catch{
            res.redirect("/teacher");
        }
        
        
        
    });







    //Logout
    app.get("/logout",function(req,res){
        app.currentGroup = undefined;
        res.clearCookie("token");
        res.redirect("/");
    });

    app.get("*", async function(req, res){
        user = await getUser(req,res);
        if(!user){
            res.render('error', {title:"Fel",layout:"layout"});
        }
        else{
            res.render('error', {title:"Fel",layout:"loggedin", user:user});
        }
        
    });









    // ----------   Funktioner   ------------


    async function teacherOnly(req,res,next){
        try{
            //Hämtar användaren
            user = await getUser(req,res);
            //Kollar ifall användaren är en lärare
            if(user.group == 0){
                //Är användaren det så fortsätter vi in i routen
                next();
            }
            else{
                //Annars redirectar vi till elevens sida
                res.redirect("/pupil");
            }
        }
        catch{
            //Fungerar inget så redirectar vi till startsidan
            res.redirect("/");
        }
    }

    async function verifiedAcc(req,res,next){
        try{
            //Hämtar information om anvädnaren
            user = await getUser(req,res);

            //Är användaren inte verifierad så skickas användaren till loginsidan 
            //och ett felmeddelande kommer upp att användaren måste verifiera sig
            //och kolla i sin inkorg
            if(!user.verified){
                res.render('login',{title:"Ej verifierad", 
                errmess:"Du måste verifiera ditt konto vänligen kolla din inkorg"});
            }
            else{
                //annars skickas vi vidare till nästa middleware eller till routen
                next();
            }
        }
        catch{
            res.redirect("/");
        }
        
    }


      

        

    //Denna funktion kontrollerar så att tokenen är rätt och giltlig
    function auth(req,res,next){
        
        try{
            //Token hämtas från kakorna
            let token = req.cookies.token;
        
            //Är den giltlig
            if(!(token === undefined)){
                //Verifierar token med hjälp av JWT.verify och den 
                //hemliga nyckel som ligger i miljövariablarna
                jwt.verify(token,process.env.PRIVATEKEY, async function(err,decoded){

                    //Går den att decoda så letar vi upp mailen i mongoDB databasen
                    if(decoded !== undefined){
                        await app.users.findOne({"email": decoded.email},function(err,data){
                            //Finns mailen där jämförs de två hasherna och stämmer
                            //de överens skickas användaren vidare till nästa middleware
                            // eller skickas vidare till routen
                            if(!(data == null)){
                                
                                //kontrollerar så att hasherna stämmer överens med varandra
                                if(data.password == decoded.password){
                                    //Sätter gruppen till rätt användarbehörighet
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
                //Om det token skulle gått ut eller den inte stämmer med signeringen
                //kommer den att nollställas
                res.clearCookie("token");
                app.currentGroup = undefined;
                next();
            }
        }
        catch(err){
            res.clearCookie("token");
            app.currentGroup = undefined;
            next();
        }
        
        
    }

    function loggedinRedirector(req,res,next){
        try{
            //Kollar ifall det är en lärare inloggad och skickar
            //Läraren till sin sida
            if(app.currentGroup == "0"){
                res.redirect("/teacher");
            }
            //Kollar ifall det är en elev inloggad och skickar
            //eleven till sin sida
            else if(app.currentGroup == "1"){
                res.redirect("/pupil");
            }
            //Annars skickas användaren vidare till routen
            else{
                next();
            }
        }
        catch(err){
            console.log(err);
        }
    }

    //Funktion som endast verifierar token
    function verifyToken(req,res){
        try{
            return new Promise(function(resolve,reject){
                let token = req.cookies.token;
                jwt.verify(token,process.env.PRIVATEKEY, function(err,decoded){
                    if(decoded !== undefined){
                        resolve(decoded)
                    }
                    else{
                        req.cookies.token = "";
                        reject(0)
                    }
                });
            });
        }
        catch(err){
            req.cookies.token = "";
            res.redirect("/");
            console.log(err);
        }
        
    }

    //Hämtar användare som är inloggad
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



    async function listLessons(user){

        try{
            //console.log(user._id);
            let html = ``;
            return new Promise(function(resolve,reject){
                app.lessons.find().toArray(function(err,data){
                
                    //console.log(data);
                    let lessonId = data.filter(function(less){
                        return user._id.toString() == less.ownerId.toString();
                    })
                    //console.log(lessonId);
                        
                    lessonId.forEach(less => {
                        html += `   <div id="lessonpack">
                                    <li>${less.rubrik} <a href="/teacher/lesson/${less.key}">Visa</a><a href="/preplesson/${less.key}">Redigera</a><a href="/teacher/removeless/${less.key}">Ta bort</a></li>
                                    </div>                    
                                `;
                    });
                    
                    resolve(html);
                    if(err){
                        reject(null);
                    }
                });
                
                
            });
        }
        catch(err){
            reject(null);
        }
        
    }

    async function setLesson(req,res,code,owner){

        try{
            let owne = owner;
            await app.lessons.findOne({"key": code},async function(err,data){
                var lesson = {key:code, info:req.body.info, ownerId:owner._id, rubrik:req.body.rubrik};
                if(data == null){
                    await app.lessons.insertOne(lesson,function(err,result){
                        if(err){
                            console.log(err);
                        }
                    });
                }
                else{
                    setLesson(req,res,codeGen(6),owne);
                }
                
            });
        }
        catch(err){
            console.log(err);
        }
    }

    async function updateLesson(lesson){

        try{
            await app.lessons.updateOne({"_id":app.objID(lesson.oid)},{$set:{info:lesson.info, rubrik:lesson.rubrik}},function(err){
                if(err){
                    console.log(err);
                }
            });
        }
        catch(err){
            console.log(err);
        }
    }

    function getLesson(code){

        try{
            return new Promise(async function(resolve,reject){
                await app.lessons.findOne({"key": code}, function(err,data){
                    
                    if(!err){
                        resolve(data);
                        
                    }
                    else{
                        reject(null);
                    }
                    
                });
            });
        }
        catch(err){
            console.log(err);
        }
    }
    
    function removeLesson(code){

        try{
            return new Promise(async function(resolve,reject){
                await app.lessons.deleteOne({"key": code}, function(err,data){
                   
                    if(!err){
                        resolve(true);
                        
                    }
                    else{
                        reject(false);
                    }
                    
                });
            });
        }
        catch(err){
            console.log(err);
        }
    }
    
}