"use strict";

const express = require("express");
const bodyParser = require("body-parser");
const fccTesting = require("./freeCodeCamp/fcctesting.js");
const session = require("express-session");
const mongoose = require("mongoose");
const passport = require("passport");
const GitHubStrategy = require("passport-github").Strategy;
const cors = require("cors");

const app = express();

fccTesting(app); //For FCC testing purposes

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use("/public", express.static(process.cwd() + "/public"));

app.set("view engine", "pug");

mongoose.connect(process.env.DATABASE, {
  useUnifiedTopology: true,
  useNewUrlParser: true,
  useCreateIndex: true
});

// get reference to database
const db = mongoose.connection;

// define Schema
const Schema = mongoose.Schema;

var UserSchema = new Schema({
  id: String,
  name: String,
  photo: String,
  email: String,
  created_on: Date,
  provider: String,
  last_login: String,
  login_count: Number
});

// compile schema to model
var SocialUser = mongoose.model("SocialUsers", UserSchema);

db.on("error", err => console.log("Database error: " + err));

db.on("connected", () => {
  console.log("Successful database connection");

  app.use(
    session({
      secret: process.env.SESSION_SECRET,
      resave: true,
      saveUninitialized: true
    })
  );
  app.use(passport.initialize());
  app.use(passport.session());

  const ensureAuthenticated = (req, res, next) => {
    if (req.isAuthenticated()) {
      return next();
    }
    res.redirect("/");
  };

  passport.serializeUser((user, done) => done(null, user.id));

  passport.deserializeUser((id, done) =>
    SocialUser.findOne({id}, (err, doc) => done(null, doc))
  );

  /*
   *  ADD YOUR CODE BELOW
   */

  // Configure Github Strategy
  /*
   * allows you to search for an object and update it, as well as insert the object if it doesn't exist and receive the new object back each time in our          * callback function. In this example, we always set the last_login as now, we always increment the login_count by 1, and only when we insert a new            * object(new * user) do we populate the majority of the fields. Something to notice also is the use of default values. Sometimes a profile returned won't      * have all the * information filled out or it will have been chosen by the user to remain private; so in this case we have to handle it to prevent an error
   */
  passport.use(
    new GitHubStrategy(
      {
        clientID: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET,
        callbackURL:
          "https://atlantic-meadow-sloth.glitch.me/auth/github/callback"
      },
      (accessToken, refreshToken, profile, callback) => {
        SocialUser.findOneAndUpdate(
          {id: profile.id},
          {
            $setOnInsert: {
              id: profile.id,
              name: profile.displayName || "John Doe",
              photo: profile.photos[0].value || "",
              email: profile.emails[0].value || "No public email",
              created_on: new Date(),
              provider: profile.provider || ""
            },
            $set: {
              last_login: new Date()
            },
            $inc: {
              login_count: 1
            }
          },
          { upsert: true, new: true, useFindAndModify: false }, //Insert object if not found, Return new object after modify
          (err, doc) => err ? callback(err, null) : callback(null, doc)
        );
      }
    )
  );

  app.route("/auth/github").get(passport.authenticate("github"));

  app
    .route("/auth/github/callback")
    .get(
      passport.authenticate("github", { failureRedirect: "/" }),
      (req, res) => {
        res.redirect("/profile");
      }
    );
  /*
   *  ADD YOUR CODE ABOVE
   */

  app.route("/").get((req, res) => {
    res.render(process.cwd() + "/views/pug/index");
  });

  app.route("/profile").get(ensureAuthenticated, (req, res) => {
    res.render(process.cwd() + "/views/pug/profile", { user: req.user });
  });

  app.route("/logout").get((req, res) => {
    req.logout();
    res.redirect("/");
  });

  app.use((req, res, next) => {
    res
      .status(404)
      .type("text")
      .send("Not Found");
  });

  app.listen(process.env.PORT || 3000, () => {
    console.log("Listening on port " + process.env.PORT);
  });
});
