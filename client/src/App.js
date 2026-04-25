import { useState, useEffect, useRef } from 'react'
import { ChatMessage, TokenPrice, HookSlider } from './library/components'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCircleQuestion } from '@fortawesome/free-solid-svg-icons'
import './index.css'
import AudioRecorder from './library/audioRecorder'
import FlagsContainer from './library/flagsContainer'

function App() {

  const [model, setModel] = useState("gpt-4o-mini")
  const [input, setInput] = useState("")
  const [contextPrompt, setContextPrompt] = useState("")
  const [chatLog, setChatLog] = useState([{ role: "system", content: "" }])
  const [maxTokens, setMaxTokens] = useState(100)
  const messagesEndRef = useRef(null);
  const [transcription, setTranscription] = useState('');
  const handleTranscription = (text) => {
    setTranscription(text);
  };
  const [selectedLang, setSelectedLang] = useState({flag: null, name: "Select a langage"})

  const handleToggleAside = (bool) =>{

  }

  console.log(model)

  const handleSelectLang = (lang) => {
    setSelectedLang(lang)
    setContextPrompt(`Je veux que tu agisse comme un professeur ${lang.promptInfo.determinant}${lang.name}. Tu dois annalyser si j'ai commis une erreur. Si je fais une erreur la première partie de ta réponse sera une correction en français et entre les balises <explanation></explanation>. De plus, tu écriras <result>WRONG</result> si j'ai commis une erreur, sinon tu écriras <result>RIGHT</result> dans la première partie. La deuxième partie sera ta réponse en ${lang.name} a ce que je viens de te dire, pas de correctif ici, juste une réponse naturelle. Ta réponse sera de niveau A1(CECRL), elle sera courte et facile à comprendre. Tu mettra la deuxième partie de ta réponse dans des balises commencent par ${"<"+lang.promptInfo.codeIso}> et finissant par ${"</"+lang.promptInfo.codeIso}>. `)
    const newContextPrompt = chatLog.map((el)=>{ 
      if (el===chatLog[0]){
        return { role: "system", content: contextPrompt }
      }else {return el}})
    setChatLog(newContextPrompt)
  }

  useEffect(()=>{
    setInput(transcription)
  },[transcription])

  const scrollToBottom = () => {
    messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
  }

  useEffect(() => {
    scrollToBottom();
  }, [chatLog]);

  async function handleSubmit(e){

    e.preventDefault()
    let chatLogRefresh =([...chatLog, {role: "user", content: `${input}`} ])
    setInput("")
    setChatLog(chatLogRefresh)

    const response = await fetch("http://localhost:4080/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        messages: chatLogRefresh,
        model: model,
        maxTokens: maxTokens
      })
    }).then(setChatLog([...chatLogRefresh, { role: "assistant", isWaiting: true } ]))

    const data = await response.json()
    const audioRes = await fetch(`http://localhost:4080${data.audioUrl}`, {
      method: "GET"
    })

    const success = [...data.GPTresponse.matchAll(/<result>(.*?)<\/result>/g)];
    const errorMessage = [...data.GPTresponse.matchAll(/<explanation>(.*?)<\/explanation>/g)];
    const result = [...data.GPTresponse.matchAll(/<de>(.*?)<\/de>/g)];
    const cleanedGPTResponse = data.GPTresponse?.replace(/<result>.*?<\/result>\s*/s, '').replace(/<explanation>.*?<\/explanation>\s*/s, '').replace(/<de>.*?<\/de>\s*/s, '');
    const updatedChatLog = [...chatLogRefresh];
    const audioBlob = await audioRes.blob(); // Get the audio as a blob
    const audioUrl = URL.createObjectURL(audioBlob); // Create a URL for the blob
    const audio = new Audio(audioUrl); // Create a new Audio object
    audio.play(); // Play the audio

    if (updatedChatLog.length > 0) {
      updatedChatLog[updatedChatLog.length - 1] = {
        ...updatedChatLog[updatedChatLog.length - 1],
        success: success[0][1], 
        errorMessage: errorMessage.length>0 ? errorMessage[0][1] : ""
      };
    }

    updatedChatLog.push({
      role: "assistant",
      content: `${data.GPTresponse}`,
      cleanedGPTResponse: result.length>0 ? result[0][1] : cleanedGPTResponse
    });
    
    setChatLog(updatedChatLog);
  }

  return (
    <div className='app'>

      <aside className='aside'>

        <div onClick={handleToggleAside}>Ouvrir</div>

        <div className='models-list'>
          <select className='models-selector' defaultValue="gpt-4o-mini" onChange={(e) => {
            setModel(e.target.value)
            }}>
            <option value="gpt-4.1-2025-04-14">gpt-4.1</option>
            <option value="gpt-4o-mini">gpt-4o-mini</option>
            <option value="gpt-3.5-turbo">gpt-3.5-turbo</option>
            <option value="code-davinci-002">code-davinci-002</option>
            <option value="ada">ada</option>
          </select>
        </div>
        
        <h1>Options</h1>

        <div className='hook-sliders'>
          <HookSlider label="max tokens" description="The amount of maximum tokens allowed for the response" 
          state={maxTokens} setState={setMaxTokens} step="1" min="1" max="200" />
        </div>

        <FlagsContainer handleSelectLang={handleSelectLang} selectedLang={selectedLang}/>

      </aside>

      <section className='chatBox'>

        <nav className='navBar'>
          
          <ul className='navList'>
            <h1>Chat</h1>
            
            <div className='contextCheckbox'>
              <input type="checkbox" id="context" name="context" onClick={(e)=> document.querySelector(".context").classList.toggle("true")}>
              </input><label for="context">Context Prompt</label>

              <div className='tooltip'>
                <FontAwesomeIcon icon={faCircleQuestion} />
                <span className='tooltipText'>"Context prompt" set the behavior of  chatGPT. For example, try "You are a caveman. You will answer using a “caveman” tone ". Please note that this functionality is not always working well.</span>
              </div>

            </div>
            
          
            
          </ul>
          
          <div className='context'>
              
            <form onSubmit={(e) => { 
              e.preventDefault()
              }}>
              <input value={contextPrompt} type='text' className='context-textarea'
                onChange={(e) => setContextPrompt(e.target.value)}
              ></input>
            </form>

          </div>
        </nav>
       
        <div className='chatLog'>      

          <ChatMessage message={{ role: 'assistant', content: 'Bonjour, comment puis-je vous aider ?' }} />
        
          {chatLog.filter((msg) => msg.role === "assistant" || msg.role === "user").map((message, index) => (
            <ChatMessage key={index} message={message}/>
          ))}

          <div ref={messagesEndRef} />

        </div>
        
        <div className='chat-input-box'>
          <form onSubmit={handleSubmit} className='chat-form'>
            <input  value={input} className='chat-input' onChange={(e)=> setInput(e.target.value)}></input>
            <AudioRecorder onTranscription={handleTranscription} selectedLang={selectedLang}/>
          </form>
          
        </div>
      </section>
    </div>
  )
} 

export default App