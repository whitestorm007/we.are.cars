const express = require("express");
const database = require('mongodb').MongoClient;
var axios = require('axios');

const Instagram = require('./app/src/index.js')
const FileCookieStore = require('tough-cookie-filestore2')

const fs = require("fs");
const app = express();

const PORT = process.env.PORT || 7000
const DATABASE_URL = "mongodb+srv://storm:jeet8866@instagram.elday.mongodb.net"
const username = "we.are.cars"
const password = "Jeet88@66"

const cookieStore = new FileCookieStore('./cookies.json')
const client = new Instagram({ username, password, cookieStore })


let err = null;


(async() => {
    await client.login();

    app.get("/db", (req, res) => {
        let query = req.query.q
        let update = req.query.u

        database.connect(DATABASE_URL, function(err, db) {
            if (err) throw err;
            var dbo = db.db("instagram");
            dbo.collection(username).updateOne(query, update, function(err, ress) {
                if (err) throw err;
                console.log("1 document updated");
                res.send(ress)
                db.close();
            });
        });

    })
    app.get("/", (req, res) => {
        database.connect(DATABASE_URL, function(err, db) {
            if (err) throw err;
            var dbo = db.db("instagram");
            dbo.collection(username).findOne({ type: "keyword" }, function(err, result) {
                if (err) throw err;
                const random = Math.floor(Math.random() * result.data.length);
                let keyWord = result.data[random]
                console.log(keyWord.name);
                dbo.collection(username).find({ keyWord: keyWord.name }).toArray(function(err, result) {
                    processResult(result, keyWord)
                        //   console.log(result);
                    db.close();
                })


            });
        });
        res.json({ code: "done", err: err });
    });

    let PAGE = 0


    function getRadome(x) {
        return Math.floor(Math.random() * x);
    }

    function processResult(database, keyWord) {

        console.log("fetching response");
        var config = {
            method: 'get',
            url: `https://api.unsplash.com/search/photos?client_id=3VYhoQ9PHHWoHLo5GmhuP1Fm3KboU6FGNd4k42e6LIE&query=${keyWord.name}&per_page=50&page=${PAGE}`,
            headers: {
                'Accept-Version': 'v1',
                'Cookie': 'ugid=d477d10843e2ec7bf9a822c069c0ff525523059'
            }
        };
        axios(config)
            .then(function(response) {
                console.log("validating  response");

                validateRes()

                function validateRes() {
                    let random = getRadome(response.data.results.length)
                    let randomResponse = response.data.results[random]
                    randomResponse.keyword = keyWord.name
                    if (database.length === 0) {
                        PAGE = 0;
                        makePost(randomResponse, keyWord)
                        return;
                    }


                    let id = randomResponse.id

                    for (let i = 0; i < database.length; i++) {

                        if (database[i].id === id) {
                            console.log("finding next shit");
                            response.data.results.splice(random, 1);
                            validateRes()
                            break;
                        }

                        if (i === database.length - 1) {
                            console.log("making post");
                            PAGE = 0;
                            makePost(randomResponse, keyWord)
                            return
                        } else {
                            let totalPage = response.data.total_pages;
                            PAGE = (PAGE !== totalPage) ? PAGE + 1 : err = "all data Posted of " + keyWord.name;
                            processResult(database, keyWord)
                        }

                    }
                }
            })
            .catch(function(error) {
                console.log(error);
                err = error
            });

    }

    async function makePost(data, keywords) {
        console.log(keywords);
        console.log("making post");
        let myDb = {
            id: data.id,
            keyword: data.keyword,
            createdAt: new Date().getTime(),
            description: data.description,
            urls: data.urls,
            instagram: data.user.social.instagram_username
        }
        let hashtag = keywords.keyWord
        const photo = data.urls.regular
        let des = (myDb.description === null) ? "" : myDb.description
        database.connect(DATABASE_URL, function(err, db) {
            if (err) throw err;
            var dbo = db.db("instagram");

            dbo.collection(username).insertOne(myDb, function(ersr, res) {
                if (ersr) { err = ersr };
                console.log("1 document inserted");
                db.close();
            });
        });

        try {
            let caption = `${des}\n\n\n  @${myDb.instagram} \n\n\n${hashtag}`
            console.log(caption);
            const { media } = await client.uploadPhoto({ photo: photo, caption: caption, post: 'feed' })

        } catch (error) {
            console.log(error);
        }

    }

    app.listen(PORT, () => {
        console.log("server is running on ", PORT);
    });
})()