require('dotenv').config()
const express = require('express')
const bodyParser = require('body-parser')
const cors = require('cors')
const path = require("path")
const fs = require("fs")
const multer = require('multer')

const app = express()
app.use(bodyParser.json())
app.use(cors())

const OpenAI = require("openai")
const port = 4080

const configuration = {
    organization: process.env.OPENAI_ORG,
    project: process.env.PROJECT_ID,
    apiKey: process.env.OPENAI_API_KEY,
}
const openai = new OpenAI(configuration)
app.get('/speech.mp3', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/speech.mp3'));
});
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/')
    },
    filename: function (req, file, cb) {
        cb(null, file.fieldname + '-' + Date.now() + ".webm");
    }
});

const upload = multer({ storage: storage });
app.post('/transcribe', upload.single('audio'), async (req, res) => {
    console.log(req.body?.lang)
    try {
        const audioFile = fs.createReadStream(req.file.path);
        
        const response = await openai.audio.transcriptions.create({
            model: "whisper-1",
            file: audioFile,
            language: JSON.parse(req.body.lang).promptInfo.codeIso,
        });

        res.json({
            text: response.text,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to transcribe audio' });
    }
    // Supprime le fichier après traitement
    fs.unlinkSync(req.file.path);
});
app.post('/', async (req, res) => {

    const { messages, model, maxTokens } = req.body

    let response
    let errMessage
    let contextPrompts = messages.filter((msg) => { return msg.role === 'system' })

    // Debug outputs
    function logInputValues() {
        console.log("\n"+`Context prompt : ${contextPrompts[contextPrompts.length-1].content} (${typeof(contextPrompts[contextPrompts.length-1].content)})`)
        console.log(`User Input : ${messages[messages.length-1].content} (${typeof(messages[messages.length-1].content)})`)
        console.log(`Model : ${model} (${typeof(model)})`)
        console.log(`MaxTokens : ${maxTokens} (${typeof(maxTokens)})`)
    }

    // Uncomment the next line to test Input values
    logInputValues()

    try {
        response = await openai.chat.completions.create({
        model: model,
        messages: messages,
        /*max_tokens: parseInt(maxTokens)*/
        })
    } catch(e) { console.log(e) }
    
    const speechFile = path.resolve("../client/speech.mp3");
    const input = response.choices[0].message.content;
    const matches = input.match(/<de>(.*?)<\/de>/g);

    const wordsBetweenTags = matches?.map(match => match.replace(/<\/?de>/g, ""));
    console.log("Partie à écouter : " + wordsBetweenTags? wordsBetweenTags : "Partie à écouter : undefined");
    
    const mp3 = await openai.audio.speech.create({
        model: "tts-1",
        voice: "echo",
        input: wordsBetweenTags ? wordsBetweenTags.join(" ") : input,
      });

    const buffer = Buffer.from(await mp3.arrayBuffer());
    
    try {
    await fs.promises.writeFile(speechFile, buffer)
    res.json({
        GPTresponse: response.choices[0].message.content,
        ErrorResponse: errMessage,
        Price: response.usage,
        audioUrl: "/speech.mp3",
    })
    } catch (error) {
        console.log(error)
    }

})

app.listen(port, () => {
    console.log(`Server is running on port ${port}`)
})