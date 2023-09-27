<template>
  <div class="container mx-auto max-w-screen-2xl px-5 md:px-0">
    <div className="header-section">
      <h1>AI Assistant 🤖</h1>
    </div>
    <div v-if="storedValues">
      <div>
        <hr class="hr-line" />
        <div class="answer-container">
          <div
            v-for="(value, index) in storedValues"
            :key="index"
            class="answer-section"
          >
            <p class="question">{{ value.question }}</p>

            <div v-if="value.answer" class="answer">
              <div class="markdown-block" :class="{ 'markdown-block__dense': dense }" v-html="value.answer"></div>

              <div v-if="value.citations.length > 0">
                <p class="answer citations-title">Citations:</p>
                <ul class="answer citation-list">
                  <li v-for="(citation, citationIndex) in value.citations" :key="citationIndex">
                    <a :href="citation.url" class="answer-citation-link" target="_blank">
                      {{ citation.title }}
                    </a>
                  </li>
                </ul>
              </div>
            </div>
            <div class="loading-indicator" v-else="value.answer" >
              Thinking
              <div class="dot"></div>
              <div class="dot"></div>
              <div class="dot"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="form-section">
      <textarea
        rows="5"
        class="form-control"
        placeholder="Ask me anything..."
        v-model="newQuestion"
      ></textarea>
        <button class="btn" @click="submitQuestion">
          Generate Response 🤖
        </button>
    </div>
  </div>
</template>

<script lang="ts">
import { watch, defineComponent } from 'vue'
import { OpenAIClient, AzureKeyCredential } from '@azure/openai';
import MarkdownIt from 'markdown-it'
import hljs from 'highlight.js'

const openAiEndpoint = import.meta.env.VITE_AZURE_OPENAI_ENDPOINT;
const azureApiKey = import.meta.env.VITE_AZURE_OPENAI_KEY;
const azureDeployment = import.meta.env.VITE_AZURE_DEPLOYMENT;

// Azure Cognitive Search endpoint, admin key, and index name
const azureSearchEndpoint = import.meta.env.VITE_AZURE_SEARCH_ENDPOINT;
const azureSearchAdminKey = import.meta.env.VITE_AZURE_SEARCH_KEY;
const azureSearchIndexName = import.meta.env.VITE_AZURE_SEARCH_INDEX;

export default defineComponent({
  name: 'Search',
  components: {
  },
  data() {
    return {
      storedValues: [],
      newQuestion: ''
    };
  },
  props: {
    storedValues: {
      type: Array,
      default: () => []
    },
    prevStoredValues: {
      type: Array,
      default: () => []
    },
    generateResponse: {
      type: Function,
      required: true
    },
    markdown: {
      type: String,
      required: true
    },
    html: {
      type: Boolean,
      default: false
    },
    dense: {
      type: Boolean,
      default: false
    }
  },
  methods: {
    render(markdown) {
      const md = MarkdownIt({
        html: this.html,
        highlight: function (code, inputLang) {
          let output
          let outputLang

          if (inputLang && hljs.getLanguage(inputLang)) {
            const result = hljs.highlight(code, { language: inputLang })
            output = result.value
            outputLang = result.language
          } else {
            const result = hljs.highlightAuto(code)
            output = result.value
            outputLang = result.language
          }

          return `<pre class="hljs language-${outputLang}"><code>${output}</code></pre>`
        }
      })

      return md.render(markdown);
    },
    submitQuestion() {
      watch(this.storedValues, (newVal, oldVal) => {
        this.prevStoredValues.value = oldVal.slice();
      });
       this.storedValues.push({ question: this.newQuestion });
       generateResponse(this.newQuestion, this.resetQuestion).then(response => {
         this.storedValues.pop();
         this.storedValues.push({ question: response.question, answer: this.render(response.answer), citations: response.citations })
       }).catch(error => {
         console.error("Error:", error);
       })
    },
    resetQuestion() {
      this.newQuestion = '';
    }
  }
})

const messages = [
  {
    role: "system",
    content: "You are an AI assistant that helps developers discover and use RESTful APIs.  You have access to details of all the APIs that are available for the developer to use.  You should provide responses which detail request parameters and responses. You can provide code samples if requested. All your responses are returned in Markdown.",
  },
]

const filterCitations = (botResponse, citationsFromResponse) =>{
  const docCitationIndexes = new Set();
  console.log(botResponse);
  const answer = botResponse
    .replace(/\[doc(\d+)](?:\s*\[doc\d+])*/g, (match, number) => {
      return `[doc${number}]`;
    }) // filter duplicate citations: "[doc1][doc2][doc3] Some text [doc4][doc5] More text [doc6]" -> "[doc1] Some text [doc4] More text [doc6]";
    .replace(/\[doc(\d+)\]/g, (match, docNumber) => {
      docCitationIndexes.add(parseInt(docNumber - 1, 10));
      return '';
    }) // replace [docX], with [Y], where [Y] is the index of the citation
    .replace(/{endOfTokens}/g, ""); // removes {endOfTokens} string from text

  const docCitationIndexArray = Array.from(docCitationIndexes);
  console.log(docCitationIndexArray);

  // Filter citations based on docCitationIndexArray (to only include citations mentioned in the text) and unique URLs
  const relevantCitations = docCitationIndexArray.map((index) => {
    return {
      title: citationsFromResponse[index].title,
      url: citationsFromResponse[index].url,
    };
  });

  // Filter citations and remove duplicates by URL
  const citations = [];
  relevantCitations.forEach((citation) => {
    console.log(citation);
    const existingCitation = citations.find(
      (existing) => existing.url === citation.url
    );
    if (!existingCitation) {
      citations.push({
        title:
          citation.title, // [${docCitationIndexArray[citations.length]}] ` + adds the citation number to the title
        url: citation.url,
      });
    }
  });

  return { answer, citations };
}

const generateResponse = async (newQuestion, setNewQuestion) => {
  const client = new OpenAIClient(
    openAiEndpoint,
    new AzureKeyCredential(azureApiKey)
  );

    messages.push({ role: "user", content: newQuestion});

    try {
      const response = await client.getChatCompletions(
        azureDeployment, // assumes a matching model deployment or model name
        messages,
        {
          maxTokens: 12800,
          topP: 1,
          azureExtensionOptions: {
            extensions: [
              {
                type: "AzureCognitiveSearch",
                parameters: {
                  endpoint: azureSearchEndpoint,
                  key: azureSearchAdminKey,
                  indexName: azureSearchIndexName,
                  inScope: true,
                  fieldsMapping: {
                    contentFields: ["content"],
                    contentFieldsSeparator: "\n",
                    filepathField: null,
                    titleField: "title",
                    urlField: "url",
                    vectorFields: [],
                  },
                },
              },
            ],
          },
        }
      );
      messages.push({ role: "assistant", content: response.choices[0].message.content});

      const answerResponse = response.choices[0].message.content;
      const citationsFromResponse = JSON.parse(
        response.choices[0].message.context.messages[0].content
      ).citations;

      const { answer, citations } = filterCitations(
        answerResponse,
        citationsFromResponse
      );

      // const citationsResponse = citationsFromResponse.map((citation) => {
      //   return {
      //     title: citation.title,
      //     url: citation.url,
      //   };
      // });
      //
      // // const uniqueCitations = computed(() => {
      // //   const uniqueTitles = new Set(citationsResponse.map(item => item.title));
      // //   return Array.from(uniqueTitles).map(title => citationsResponse.find(item => item.title === title));
      // // });
      //
      // const matchedWords = computed(() => {
      //   const words = answerResponse.split(/\s+/);
      //   const matched = words.filter(word => word.startsWith('[doc')).map(word => word[4]);
      //   return [...new Set(matched)]; // Convert the Set back to an array after removing duplicates
      // });
      //
      // const uniqueCitations = [...new Set([...matchedWords.value].map(index => citationsResponse[+index]))]
      //
      // console.log(...matchedWords.value)
      // console.log(uniqueCitations)

      setNewQuestion()
      return { question: newQuestion, answer: answer, citations: citations }
    } catch (error) {
      console.log("error occured: ", error);
      console.log({ botResponse: error });
    }

};

</script>



<style type="text/css">
@import '/node_modules/highlight.js/styles/github.css';

.loading-indicator {
  padding: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;  /* Makes it a circle */
  background-color: #333;  /* Dot color */
  margin: 0 5px;  /* Some space between the dots */
  opacity: 0.4;   /* Initial low opacity */

  /* Animation */
  animation: flash 1.5s infinite;
}

.dot:nth-child(1) {
  animation-delay: 0s;
}

.dot:nth-child(2) {
  animation-delay: 0.5s;
}

.dot:nth-child(3) {
  animation-delay: 1s;
}

@keyframes flash {
  0%, 100% {
    opacity: 0.4;
  }
  50% {
    opacity: 1;
  }
}


.markdown-block {
  line-height: 20px;
  padding: 20px;

&__dense {
   padding: 0;
 }

p, pre, ul, ol {
&:not(:last-child) {
   margin-bottom: 20px;
 }
}

pre {
  border-radius: 5px;
  background-color: #f5f5f5;
}

ul, ol {
  list-style-position: inside;
}

a {
  color: #2979ff;
}
}

.header-section h1 {
  font-size: 2.7rem;
  font-weight: 700;
}

.header-section p {
  font-size: 1rem;
  font-weight: 300;
  margin-top: 10px;
}

.form-section {
  margin: 30px 0;
}

textarea.form-control,
button.btn {
  width: 100%;
  border-radius: 5px;
  border: none;
}

.form-control {
  margin-bottom: 20px;
  padding: 20px;
  font-size: 1rem;
  font-family: 'Poppins',
  sans-serif;
  outline: none;
  background-color: #343536;
  color: #DADADB;
  transition: all 0.5s ease-in-out;
}

.form-control:focus {
  border-left: 5px solid #CA228C;
  border-top: 5px solid #CA228C;
  border-top-left-radius: 0%;
  border-bottom-left-radius: 0%;
  border-top-right-radius: 0%;
}

.btn {
  background: #000000;
  color: #DADADB;
  padding: 20px 0;
  font-size: 1.2rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.5s ease-in-out;
}

.btn:hover {
  border-left: 5px solid #CA228C;
  border-top: 5px solid #CA228C;
  border-top-left-radius: 0%;
  border-bottom-left-radius: 0%;
  border-top-right-radius: 0%;
}

.hr-line {
  margin: 70px 0 20px;
  border: 1px solid #343536;
}

.answer-section {
  margin: 30px 0;
  position: relative;
  border: solid #CA228C;
}

.answer-section .question {
  background-color: #CA228C;
  padding: 20px;
}


.answer-section .answer {
  padding: 20px;
}

.copy-icon {
  position: absolute;
  background-color: #000000;
  width: 50px;
  height: 50px;
  border-radius: 5px;
  display: flex;
  justify-content: center;
  align-items: center;
  bottom: -10px;
  right: -10px;
  font-size: 1.2rem;
  cursor: pointer;
  transition: all 0.5s ease-in-out;
}

.copy-icon:hover {
  background-color: #CA228C;
}
</style>
