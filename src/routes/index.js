const express = require('express');
const router = express.Router();
const cheerio = require('cheerio');
const request = require('request-promise');
const Axios = require("axios");
const moment = require('moment');
const fs = require('fs');
const Path = require('path')
const zlib = require('zlib');
const readline = require('readline');
const mongoose = require('mongoose');

const fetchPage = async (url, n) => {
    try {
        const result = await Axios.get(url);
        //console.log(result.data)
        return result.data;
    } catch (err) {
        if (n === 0) throw err;

        console.log("fetchPage(): Waiting For 3 seconds before retrying the request.")
        await waitFor(3000);
        console.log(`Request Retry Attempt Number: ${7 - n} ====> URL: ${url}`)
        return await fetchPage(url, n - 1);
    }
};

const CDTData = async () => {
    const html = await fetchPage('http://ctdbase.org/downloads', 6);
    const $ = cheerio.load(html);
    try {

        const websiteTableContent = $('#pagetoc ol a');
        const catalogues = websiteTableContent.map(async (i, a) => {
            result = $(a).attr('href');
            return result.substring(1, result.length);
            //CDTCatalogue.push($(a).attr('href'))
        }).get();

        return Promise.all(catalogues);
    } catch (error) {
        throw error;
    }
}

const CDTDataLinksAll = async (data) => {
    const html = await fetchPage('http://ctdbase.org/downloads', 6);
    const $ = cheerio.load(html);
    var CDTCatalogueLinks = [];
    data.forEach(element => {
        //console.log(element + " table tbody a")
        //let CDTElement = $(element + " table tbody a");
        const CDTElement = $(element);
        CDTElement.each((i, e) => {
            const CDTLink = $(e).find('table.filelisting tbody tr td a');
            const CDTDate = $(e).find('table.filelisting tbody tr td');
            //console.log(i, CDTLink.attr('href'), CDTDate.next().html(), CDTDate.next().next().html());
            let link = CDTLink.attr('href');
            if (link.substring(link.length - 6, link.length) == "csv.gz" || link.substring(link.length - 3, link.length) == "csv") {
                CDTCatalogueLinks.push("http://ctdbase.org" + CDTLink.attr('href') + "|" + CDTDate.next().html() + "|" + CDTDate.next().next().html());
            }
        });

    })
    return CDTCatalogueLinks;
}

const CDTDataLink = async (reference) => {
    const html = await fetchPage('http://ctdbase.org/downloads', 6);
    const $ = cheerio.load(html);
    var CDTCatalogueLinks = [];
    const CDTElement = $(reference);
    CDTElement.each((i, e) => {
        const CDTLink = $(e).find('table.filelisting tbody tr td a');
        const CDTDate = $(e).find('table.filelisting tbody tr td');
        //console.log(i, CDTLink.attr('href'), CDTDate.next().html(), CDTDate.next().next().html());
        let link = CDTLink.attr('href');
        if (link.substring(link.length - 6, link.length) == "csv.gz" || link.substring(link.length - 3, link.length) == "csv") {
            CDTCatalogueLinks.push("http://ctdbase.org" + CDTLink.attr('href') + "|" + CDTDate.next().html() + "|" + CDTDate.next().next().html());
        }
    });
    return CDTCatalogueLinks;
}

const CDTFieldList = async (reference) => {
    const html = await fetchPage('http://ctdbase.org/downloads', 6);
    const $ = cheerio.load(html);
    var CDTCatalogueFields = [];
    const CDTElement = $(reference);
    CDTElement.each((i, e) => {
        const CDTFields = $(e).find('span.field');
        //console.log(i, CDTLink.attr('href'), CDTDate.next().html(), CDTDate.next().next().html());
        CDTFields.each((idx, a) => {
            let link = $(a).html();
            console.log(link)
            CDTCatalogueFields.push(link);
        })
    });
    return CDTCatalogueFields;
}

async function downloadFile(urlFile, folderName, fileName) {
    //const url = 'https://unsplash.com/photos/AaEQmoufHLk/download?force=true'
    const { data, headers } = await Axios({
        url: urlFile,
        method: 'GET',
        responseType: 'stream'
    });
    const totalFileLength = headers['content-length'];
    const name = await new Promise((resolve, reject) => {
        const writer = fs.createWriteStream(folderName + "/" + fileName);
        let totalLength = 0;

        data
            .on("data", chunk => {
                console.log('filename: ' + fileName + ', chunk size: ' + chunk.length + ', Loaded: ' + totalLength + ' out of ' + totalFileLength);
                writer.write(chunk, "binary");
                totalLength += chunk.length;
            })
            .on("error", reject)
            .on("end", () => {
                //console.log('File: ' + fileName + ' has been created!!!');
                console.log('Done!!!');
                writer.end();
                resolve(fileName);
            });
    });
    //await fs.writeFile(Path.resolve(__dirname, folderName, fileName));
    return name;


    //data.pipe(writer)
}

const CDTExportFiles = async (resultJSON) => {
    responseFileCreation = [];
    url = resultJSON['URL'];
    fileName = url.substring(27, url.length);
    console.log(url);
    //dir = "HistoryFiles/" + urlElement['Date']
    //date = moment(urlElement['Date']).format('MM-DD-YYYY');
    date = moment(resultJSON['Date'], "MM-DD-YYYY");
    date = moment(date).format('YYYYMMDD');
    //console.log(date);
    if (fileName.substring(fileName.length - 6, fileName.length) == "csv.gz") {
        dir = "HistoryFiles/" + fileName.substring(0, fileName.length - 7);
    } else {
        dir = "HistoryFiles/" + fileName.substring(0, fileName.length - 4);
    }

    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir);
    }

    if (!fs.existsSync(dir + "/" + date)) {
        fs.mkdirSync(dir + "/" + date);
        if (fileName != 'CTD_genes_diseases.csv.gz') {
            fileCreated = await downloadFile(url, dir + "/" + date, fileName)
            console.log('File: ' + fileCreated + ' has been created!!!');
            responseFileCreation.push('File: ' + fileCreated + ' has been created!!!')
            fileDecompressed = await CDTDecompressFiles(resultJSON)
        }
    }
    return responseFileCreation;
}

const CDTDecompressFiles = async (resultJSON) => {
    url = resultJSON['URL'];
    fileName = url.substring(27, url.length);

    //dir = "HistoryFiles/" + urlElement['Date']
    //date = moment(urlElement['Date']).format('MM-DD-YYYY');
    date = moment(resultJSON['Date'], "MM-DD-YYYY");
    date = moment(date).format('YYYYMMDD');

    if (fileName.substring(fileName.length - 6, fileName.length) == "csv.gz") {
        dir = "HistoryFiles/" + fileName.substring(0, fileName.length - 7);
    } else {
        dir = "HistoryFiles/" + fileName.substring(0, fileName.length - 4);
    }

    if (fileName.substring(fileName.length - 6, fileName.length) == "csv.gz" && fileName != "CTD_genes_diseases.csv.gz") {
        const inp = fs.createReadStream(dir + "/" + date + "/" + fileName);
        const out = fs.createWriteStream(dir + "/" + date + "/" + fileName.substring(0, fileName.length - 3));
        const unzip = zlib.createGunzip();
        inp.pipe(unzip).pipe(out);
    }
    console.log("File: " + url + " has been decompressed!!!");
}

const processLineByLine = async (fileLocation, reference) => {
    const fileStream = fs.createReadStream(fileLocation);

    const fields = CDTFieldList("#" + reference);


    const jsonResult = [];

    mongoSchema = {};
    (await fields).forEach(async field => {
        mongoSchema[field] = String
    })

    // Define schema
    var Schema = mongoose.Schema;

    var CDTTableModelSchema = new Schema(mongoSchema);

    // Compile model from schema
    const CDTTableSchema = mongoose.model(reference, CDTTableModelSchema);

    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });
    // Note: we use the crlfDelay option to recognize all instances of CR LF
    // ('\r\n') in input.txt as a single line break.

    for await (const line of rl) {
        if (line[0] != "#") {
            // Each line in input.txt will be successively available here as `line`.
            var splitString = line.split(",");
            const jsonLine = {};
            (await fields).forEach(function (field, index) {
                jsonLine[field] = splitString[index];
                //console.log(index);
                //console.log(jsonLine);
            });
            //jsonResult.push(jsonLine);
            //console.log(jsonLine);
            const newInstance = new CDTTableSchema(jsonLine);
            const saved = await newInstance.save();
            console.log(saved);
            //console.log(`Line from file: ${line}`);
        }
    }
    return jsonResult;
}

router.get('/getreferences', async (req, res) => {
    const references = await CDTData();
    //const users = await User.find();
    //const jobs = await Job.find().populate('servver');
    /*resultJSON = [];
    references.forEach(e => {
        jsonRefences = {};
        jsonRefences['refId'] = e;
        resultJSON.push(jsonRefences);
    })*/
    console.log(references);
    res.json(references);
});

router.get('/fileinfo/:id', async (req, res) => {
    //const job = await Job.findById(req.params.id);
    const fileInfo = await CDTDataLink("#" + req.params.id);
    jsonInfo = {}
    var string = fileInfo[0].split("|");
    jsonInfo['URL'] = string[0];
    jsonInfo['Date'] = string[1];
    jsonInfo['Size'] = string[2];
    res.json(jsonInfo);
});

router.get('/CDTFieldList/:id', async (req, res) => {
    //const job = await Job.findById(req.params.id);
    const fieldListInfo = await CDTFieldList("#" + req.params.id);
    res.json(fieldListInfo);
});

router.post('/downloadfile', async (req, res) => {
    //const job = await Job.findById(req.params.id);
    result = await CDTExportFiles(req.body);
    //res.sendStatus(200);
    //const fieldListInfo = await CDTFieldList("#" + req.params.id);
    res.json(result);
});

router.get('/convertjson/:id', async (req, res) => {
    ref = "#" + req.params.id;
    const fileInfo = await CDTDataLink("#" + req.params.id);
    fileInfoArray = fileInfo[0].split("|");
    url = fileInfoArray[0];
    dateArray = fileInfoArray[1];
    fileName = url.substring(27, url.length);
    console.log(url);
    //dir = "HistoryFiles/" + urlElement['Date']
    //date = moment(urlElement['Date']).format('MM-DD-YYYY');
    date = moment(dateArray, "MM-DD-YYYY");
    date = moment(date).format('YYYYMMDD');


    if (fileName.substring(fileName.length - 6, fileName.length) == "csv.gz") {
        dir = "HistoryFiles/" + fileName.substring(0, fileName.length - 7) + "/" + date + "/" + fileName.substring(0, fileName.length - 7) + ".csv";
    } else {
        dir = "HistoryFiles/" + fileName.substring(0, fileName.length - 4) + "/" + date + "/" + fileName.substring(0, fileName.length - 4) + ".csv";
    }

    console.log(dir);
    /*if (fileName.substring(fileName.length - 6, fileName.length) == "csv.gz") {
        dir = "HistoryFiles/" + fileName.substring(0, fileName.length - 3);
        console.log(dir);
    } else {
        dir = "HistoryFiles/" + fileName.substring(0, fileName.length - 4);
        console.log(dir);
    }*/

    const references = await processLineByLine(dir, req.params.id);
    //const users = await User.find();
    //const jobs = await Job.find().populate('servver');
    /*resultJSON = [];
    references.forEach(e => {
        jsonRefences = {};
        jsonRefences['refId'] = e;
        resultJSON.push(jsonRefences);
    })*/
    console.log(references);
    res.json(references);
});

module.exports = router;