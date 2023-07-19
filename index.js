const puppeteer = require('puppeteer');
const fs = require('fs');
const fetch = require('node-fetch');



const urlSteamStore = 'https://store.steampowered.com/search/?ignore_preferences=1&os=win&supportedlang=english&filter=popularcomingsoon';
let pageNumber = 1;
let maxPageNumber = 100;


let games = [];
let gamesCount = 0;
let gamesById = {0: "Saved"};

let queueGameDetails = [];



async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function saveToFile(obj, fileName) {
    // let dataFromFile = JSON.parse(fs.readFileSync(`./${fileName}.json`, err => console.log(err)));

    fs.writeFile(`./${fileName}.json`, JSON.stringify(obj), err => {
        if (err) {
            console.error(err);
            return;
        }
    });
}

async function extractGameIdsFromStorePage(page) {
    // Get page list of games
    return await JSON.parse(await page.evaluate(async () => {
        let results = document.getElementById("search_resultsRows").children;

        let gamesIdList = [];

        for (let i = 0; i < results.length; i++) {
            let id = results[i].dataset.dsAppid;

            if (id.includes(',') === false) {
                gamesIdList.push(id);
            }
        }

        return JSON.stringify({gamesIdList});
    })).gamesIdList;
}

async function extractGameInformationFromGameId(id) {
    let info = {};

    const url = `https://store.steampowered.com/api/appdetails?appids=${id}`

    const options = {
        method: 'GET'
    };

    info = await fetch(url, options)
        .then(async res => {
            return res.json();
        })
        .then(async data => {
            data = data[id].data;
            // console.log(data);

            info = {
                id: data.steam_appid,
                name: data.name,
                description: data.short_description,
                image: data.header_image,
                developers: data.developers,
                publishers: data.publishers,
                release_date: data.release_date
            }

            // Check for price
            if (data.price_overview !== undefined) {
                data.price = data.price_overview.final_formatted;
            }

            // Check for EA
            data.genres.forEach(async item => {
                if (item.id === 70) {
                    info.isEA = true;
                } else {
                    info.isEA = false;
                }
            });

            // Check for DLC
            data.categories.forEach(async item => {
                if (item.id === 21) {
                    info.isDLC = true;
                } else {
                    info.isDLC = false;
                }
            });

            return info;
        })
        .catch(err => console.log(err));

        console.log(info);
        return info;

    // OUTDATED WEBSCRAPING VERSION
    // return await JSON.parse(await page.evaluate(async (id) => {
    
    //     // Error check
    //     if (document.getElementById('error_box') !== null) {
    //         console.log('Steam Processing Error');
    //         return null;
    //     }

    //     let name = document.getElementById('appHubAppName').innerText;
    //     let details = document.getElementsByClassName('game_description_snippet')[0].innerText;
    //     let appURL = document.URL;
    //     let appImage = document.getElementById('gameHeaderImageCtn').firstElementChild.src;
    //     let releaseDate = document.getElementsByClassName('release_date')[0].innerText.slice(14);
    //     let developer = document.getElementById('developers_list').children[0].innerText;
    //     let developerLink = document.getElementById('developers_list').children[0].href;
    //     // See if publisher is different from developer
    //     let publisher = developer;
    //     let publisherLink = developerLink;
    //     /* Temp */ let tempPublisherList = document.getElementsByClassName('dev_row')[1].children[1].children;
    //     if (tempPublisherList.length > 1) {
    //         for (let i = 0; i < tempPublisherList; i++) {
    //             if (tempPublisherList[i].innerText !== developer) {
    //                 publisher = tempPublisherList[i].innerText;
    //                 publisherLink = tempPublisherList[i].href;
    //             }
    //         }
    //     }
    //     // Check if DLC
    //     let isDLC = false;
    //     /* Temp */let tempHeaderList = document.getElementsByTagName('h1');
    //     for (let i = 0; i < tempHeaderList.length; i++) {
    //         if (tempHeaderList[i].innerText === 'Downloadable Content') {
    //             isDLC = true;
    //             break;
    //         }
    //     }
    //     // Check if EA
    //     let isEA = false;
    //     if (document.getElementById('earlyAccessBody') !== null) isEA = true;

    //     let info = {
    //         appId: id,
    //         name,
    //         details,
    //         appURL,
    //         appImage,
    //         releaseDate,
    //         developer, developerLink,
    //         publisher, publisherLink,
    //         isDLC, isEA
    //     }
    //     return JSON.stringify(info);
    // }, id));
}

(async function main() {
    // Try to get any previous info saved to file
    const savedGamesInfo = 'savedGamesInfo';
    try {
        const rawGamesFromFile = fs.readFileSync(`./${savedGamesInfo}.json`, err => console.log(err));
        const gamesFromFile = await JSON.parse(rawGamesFromFile);

        gamesFromFile.games.forEach(async item => {
            games.push(item);
        });
    } catch (err) {
        console.log('\x1b[31m', `Could not gather info from files (./${savedGamesInfo}.json)...\n`, '\x1b[0m', err);

        console.log('\x1b[33m', `Creating file...`, '\x1b[0m');

        fs.writeFile(`./${savedGamesInfo}.json`, JSON.stringify({createdFromProgram: true}), err => console.log(err));
    }

    const savedGamesById = 'savedGamesById';
    try {
        const rawSavedIdFromFile = fs.readFileSync(`./${savedGamesById}.json`, err => console.log(err));
        const savedIdFromFile = await JSON.parse(rawSavedIdFromFile);

        Object.keys(savedIdFromFile.gamesById).forEach(async item => {
            gamesById[item] = 'From File';
        });
    } catch (err) {
        console.log('\x1b[31m', `Could not gather info from files (./${savedGamesById}.json)...\n`, '\x1b[0m', err);

        console.log('\x1b[33m', `Creating file...`, '\x1b[0m');

        fs.writeFile(`./${savedGamesById}.json`, JSON.stringify({createdFromProgram: true}), err => console.log(err));
    }

    const steamAppQueue = 'steamAppQueue';
    try {
        const rawQueueFromFile = fs.readFileSync(`./${steamAppQueue}.json`, err => console.log(err));
        const queueFromFile = await JSON.parse(rawQueueFromFile);

        queueFromFile.queueGameDetails.forEach(async item => {
            queueGameDetails.push(item);
        });
    } catch (err) {
        console.log('\x1b[31m', `Could not gather info from files (./${steamAppQueue}.json)...\n`, '\x1b[0m', err); 
        
        console.log('\x1b[33m', `Creating file...`, '\x1b[0m');

        fs.writeFile(`./${steamAppQueue}.json`, JSON.stringify({createdFromProgram: true}), err => console.log(err));
    }


    const browser = await puppeteer.launch({headless: 'new'});
    try {
        const page = await browser.newPage();
        await page.goto('https://store.steampowered.com/');
        await page.evaluate(() => { document.cookie = "birthtime=0; path=/; max-age=315360000" });

        
        // Store list of vidya games
        for (pageNumber = 1; pageNumber < maxPageNumber; pageNumber++) {
            let url = `${urlSteamStore}&page=${pageNumber}`;
            await page.goto(url);

            const extractedGameIds = await extractGameIdsFromStorePage(page);
            extractedGameIds.forEach(async item => {
                // console.log('\x1b[33m', `Extracted application id ${item}\x1b[0m from ${url}\x1b[0m...`, '\x1b[0m');
                console.log('\x1b[32m', `${item}\x1b[0m`);

                if (!gamesById[item]) {
                    queueGameDetails.push(item);
                } else {
                    console.log('\x1b[31m', `\tApplication id ${item}\x1b[0m from ${url}\x1b[0m is already saved!`, '\x1b[0m');
                }
            });

            // Get maxPageNumber
            if (pageNumber === 1) {
                maxPageNumber =  await page.evaluate(async () => {
                    return Promise.resolve(document.getElementsByClassName('search_pagination_right')[0].children[document.getElementsByClassName('search_pagination_right')[0].children.length - 2].innerHTML);
                })
            }

            await sleep(1500);
        }
        console.log('\x1b[90m', `Finished saving ids...`, '\x1b[0m', queueGameDetails);
        await saveToFile({queueGameDetails}, 'steamAppQueue');


        // Get game info
        for (; queueGameDetails.length > 0; ) {
            const item = queueGameDetails[0];

            if (gamesById[item]) {
                queueFromFile.shift();
            } else {

                let url = `https://store.steampowered.com/app/${item}`;

                await page.goto(url).catch(err => console.log('\x1b[31m', 'Error!', url, page, err));

                const extractedGameInfo = await extractGameInformationFromGameId(item).catch(err => console.log('\x1b[31m', `\t${item} produced and error!`, '\x1b[0m', err));

                console.log(extractedGameInfo);
                if (extractedGameInfo !== null) {
                    games.push(extractedGameInfo);
                    
                    console.log('\x1b[34m', `Application \'${extractedGameInfo.name}\' (id: ${extractedGameInfo.id}) was successfully saved!, '\x1b[0m'`)
                }

                queueGameDetails.shift();
                // saveToFile({queueGameDetails}, 'steamAppQueue');
            }

            await sleep(1200);
        };
        console.log('\x1b[90m', 'Aquired game info...');
        saveToFile({games}, 'savedGamesInfo');

        games.forEach(item => {
            console.log(item);
            if (item.id) {
                gamesById[item.id] = item.name;
            }
        });
        await saveToFile(gamesById, 'savedGamesById');

        console.log(`Games: `, games, `gamesById: `, gamesById);

    } catch (err) {
        console.error('Error in execution...', err);
    } 
    finally {
        await browser?.close().catch(err => console.log(err));
    }
})();