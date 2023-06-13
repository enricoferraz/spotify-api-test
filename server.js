import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
import NodeCache from "node-cache";
import redis from "redis";

dotenv.config();

const client = redis.createClient();
const cache = new NodeCache();
const app = express();

app.set("views", "./views");
app.set("view engine", "pug");

app.use(express.static("public"));

const redirect_uri = "http://localhost:8888/callback"; //"https://immense-basin-26137.herokuapp.com/callback";
const client_id = process.env.APP_CLIENT_ID;
const client_secret = process.env.APP_CLIENT_SECRET;
// const cacheMiddleware = (req, res, next) => {
//   const key = req.originalUrl || req.url;
//   // Check if the response is already cached
//   client.get(key, (err, cachedResponse) => {
//     if (cachedResponse) {
//       console.log(cachedResponse);
//       // If cached response exists, return it
//       return res.send(cachedResponse);
//     }

//     // If not cached, move to the next middleware or route handler
//     next();
//   });
// };

global.access_token;

app.get("/", function (req, res) {
  res.render("index");
});

app.get("/authorize", (req, res) => {
  var auth_query_parameters = new URLSearchParams({
    response_type: "code",
    client_id: client_id,
    scope: "user-library-read user-modify-playback-state",
    redirect_uri: redirect_uri,
  });

  res.redirect(
    "https://accounts.spotify.com/authorize?" + auth_query_parameters.toString()
  );
});

app.get("/callback", async (req, res) => {
  const code = req.query.code;

  var body = new URLSearchParams({
    code: code,
    redirect_uri: redirect_uri,
    grant_type: "authorization_code",
  });

  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "post",
    body: body,
    headers: {
      "Content-type": "application/x-www-form-urlencoded",
      Authorization:
        "Basic " +
        Buffer.from(client_id + ":" + client_secret).toString("base64"),
    },
  });

  const data = await response.json();
  global.access_token = data.access_token;

  res.redirect("/dashboard");
});

async function getData(endpoint) {
  const response = await fetch("https://api.spotify.com/v1" + endpoint, {
    method: "get",
    headers: {
      Authorization: "Bearer " + global.access_token,
    },
  });

  const data = await response.json();
  return data;
}

async function postData(endpoint) {
  const response = await fetch("https://api.spotify.com/v1" + endpoint, {
    method: "post",
    headers: {
      Authorization: "Bearer " + global.access_token,
    },
  });
  const data = await response.json();
  return data;
}

app.get("/dashboard", async (req, res) => {
  const userInfo = await getData("/me");
  const tracks = await getData("/me/tracks?limit=10");
  console.log(userInfo.email);
  res.render("dashboard", { user: userInfo, tracks: tracks.items });
});

app.get("/recommendations", async (req, res) => {
  const artist_id = req.query.artist;
  const track_id = req.query.track;

  //console.log(cacheMiddleware, req);

  const params = new URLSearchParams({
    seed_artist: artist_id,
    seed_genres: "rock",
    seed_tracks: track_id,
  });

  const data = await getData("/recommendations?" + params);
  // Cache the response
  //client.set(req.originalUrl, data);

  res.render("recommendation", { tracks: data.tracks });
  //res.send(data);
});

app.get("/addtoqueue", async (req, res) => {
  const track_uri = req.query.uri;

  const params = new URLSearchParams({
    uri: track_uri,
  });
  try {
    const data = await postData("/me/player/queue?" + params);
    res.render("recommendation");
  } catch (error) {
    console.log("ERRO: ", error);
  }
});

let listener = app.listen(process.env.PORT || 8888, function () {
  console.log("Your app is listening on " + listener.address().port);
});
