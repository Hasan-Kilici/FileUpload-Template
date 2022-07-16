const http = require("http"); 
const fs = require("fs"); 
const express = require("express"); 
const morgan = require("morgan"); 
const mongoose = require("mongoose"); 
const app = express();
const bodyParser = require("body-parser");
const server = http.createServer(app);
const path = require("path"); 

const cookieParser = require("cookie-parser");
const axios = require("axios");

app.use(cookieParser());
const port = 8080;

//Socket
const socketio = require("socket.io");
const io = new socketio.Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});
//Upload file
const multer = require("multer");
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "public/data");
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + "-" + uniqueSuffix + ".png");
  },
});
const upload = multer({ storage: storage });
app.post("/stats", upload.single("uploaded_file"), function (req, res) {
  console.log(req.file, req.body);
});
//Body Parser
app.use(bodyParser.json()).use(
  bodyParser.urlencoded({
    extended: true,
  })
);
//Statik
app.use(express.static("public"));
app.set("src", "path/to/views");
app.use("/uploads", express.static("public/data"));
//MongoDB
const dbURL = process.env.db;
mongoose
  .connect(dbURL, { useNewUrlParser: true, useUnifiedTopology: true })
  .then((result) => {
    app.listen(port, () => {
      console.log("mongoDB Bağlantı kuruldu");
    });
  })
  .catch((err) => console.log(err));
//Collections
const Users = require("./models/users.js");
const Photos = require("./models/photos.js");
//viewPort
app.set("view engine", "ejs");
//DB Support
app.use(morgan("dev"));
//Pages
app.get("/", (req, res) => {
  var userToken = req.cookies.id;
  Photos.find()
    .sort({ createdAt: -1 })
    .limit(8)
    .then((PhotoResult) => {
      Photos.find()
        .count()
        .then((PhotoCount) => {
          if (userToken != null) {
            Users.findById(userToken)
              .then((UserResult) => {
                res.render(`${__dirname}/src/signed/index.ejs`, {
                  title: `Anasayfa`,
                  user: UserResult,
                  photos: PhotoResult,
                  photocount: PhotoCount,
                });
              })
              .catch((err) => {
                res.render(`${__dirname}/src/pages/index.ejs`, {
                  title: `Anasayfa`,
                  photos: PhotoResult,
                  photocount: PhotoCount,
                });
                console.log("[!] Güvenlik Uyarısı (GEÇERSİZ TOKEN)");
                console.log(err);
              });
          } else {
            res.render(`${__dirname}/src/pages/index.ejs`, {
              title: `Anasayfa`,
              photos: PhotoResult,
              photocount: PhotoCount,
            });
          }
        });
    });
});
//User Profile
app.get("/user/:id", (req, res) => {
  var id = req.params.id;
  var userToken = req.cookies.id;
  Users.findById(id).then((ProfileResult) => {
    Photos.find({ userId: id }).then((PhotosResult) => {
      Photos.find({ userId: id })
        .count()
        .then((PhotoCount) => {
          if (userToken != null) {
            Users.findById(userToken)
              .then((UserResult) => {
                res.render(`${__dirname}/src/signed/user-profile.ejs`, {
                  title: `${ProfileResult.username}`,
                  profile: ProfileResult,
                  user: UserResult,
                  photos: PhotosResult,
                  photocount: PhotoCount,
                });
              })
              .catch((err) => {
                res.redirect("/");
              });
          } else {
            res.render(`${__dirname}/src/pages/user-profile.ejs`, {
              title: `${ProfileResult.username}`,
              profile: ProfileResult,
              photos: PhotosResult,
              photocount: PhotoCount,
            });
          }
        });
    });
  });
});
//User Dashboard
app.get("/user/dashboard/:id", (req, res) => {
  var userToken = req.cookies.id;
  Users.findById(userToken).then((UserResult) => {
    var id = req.params.id;
    if (userToken != id) {
      res.redirect("/");
    } else {
      Photos.find({ userId: userToken }).then((PhotoResult) => {
        Photos.find({ userId: userToken })
          .count()
          .then((PhotoCount) => {
            res.render(`${__dirname}/src/signed/user-dashboard.ejs`, {
              title: `${UserResult.username} Dashboard`,
              photos: PhotoResult,
              photocount: PhotoCount,
              user: UserResult,
            });
          });
      });
    }
  });
});
//Photo Page
app.get("/photo/:id", (req, res) => {
  var id = req.params.id;
  Photos.findById(id).then((ShowPhoto) => {
    res.render(`${__dirname}/src/pages/image.ejs`, {
      photos: ShowPhoto,
      title: `${ShowPhoto.title}`,
    });
  });
});
//Register Page
app.get("/register", (req, res) => {
  var userToken = req.cookies.token;
  if (userToken != null) {
    res.redirect("/");
  } else {
    res.render(`${__dirname}/src/pages/register.ejs`, { title: `Kayıt ol` });
  }
});
//Login Page
app.get("/login", (req, res) => {
  var userToken = req.cookies.token;
  if (userToken != null) {
    res.redirect("/");
  } else {
    res.render(`${__dirname}/src/pages/login.ejs`, { title: `Giriş yap` });
  }
});
//Sign Out
app.get("/sign-out", (req, res) => {
  res.clearCookie("id");
  res.redirect("/");
});
//Register Form
app.post("/register", (req, res) => {
  var username = req.body.username;
  Users.findOne({ username: username }, (user, err) => {
    if (user) {
      res.send(
        `Bu kullanıcı adı zaten kullanımda <a href="/register">Geri Dön</a>`
      );
    } else {
      var user = new Users({
        username: username,
        password: req.body.password,
        email: req.body.email,
      });
      user.save().then((Save) => {
        res.cookie("id", `${Save._id}`);
        res.redirect("/");
      });
    }
  });
});
//Login Form
app.post("/login", (req, res) => {
  var username = req.body.username;
  var password = req.body.password;
  Users.findOne({ username: username, password: password })
    .then((UserResult) => {
      res.cookie("id", UserResult._id);
      res.redirect("/");
    })
    .catch((err) => {
      res.send("Böyle bir kullanıcı Yok <a href='/register'>Kayıt ol</a>");
    });
});
//Upload Photo
app.post("/add/photo/:id", upload.single("uploaded_file"), (req, res) => {
  var id = req.params.id;
  Users.findById(id).then((UserResult) => {
    var photo = new Photos({
      userId: id,
      user : UserResult.username,
      photo: req.file.filename,
      title: req.body.title,
      description: req.body.description,
    });
    photo.save().then((Save) => {
      res.redirect(`/user/dashboard/${Save.userId}`);
    });
  });
});
//Remove Photo
app.post("/remove/photo/:id", (req, res) => {
  var id = req.params.id;
  var userToken = req.cookies.id;
  Photos.findByIdAndDelete(id).then((RemoveResult) => {
    res.redirect(`/user/dashboard/${userToken}`);
  });
});
