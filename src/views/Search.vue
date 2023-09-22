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
            <p class="answer" v-html="value.answer"></p>
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
import AnswerSection from '@/components/AnswerSection.vue'
import { defineComponent } from 'vue'
import { OpenAIClient, AzureKeyCredential } from '@azure/openai';

const openAiEndpoint = import.meta.env.VITE_AZURE_OPENAI_ENDPOINT;
const azureApiKey = import.meta.env.VITE_AZURE_OPENAI_KEY;
const azureDeployment = import.meta.env.VITE_AZURE_DEPLOYMENT;
const systemPrompt = import.meta.env.VITE_SYSTEM_PROMPT;

export default defineComponent({
  name: 'Search',
  components: {
    AnswerSection
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
    generateResponse: {
      type: Function,
      required: true
    }
  },
  methods: {
    submitQuestion() {
      console.log('TEST');
       generateResponse(this.newQuestion, this.resetQuestion).then(response => {
         console.log(response);
         this.storedValues = [{ question: this.newQuestion, answer: response }]
       }).catch(error => {
         console.error("Error:", error);
       })
    },
    resetQuestion() {
      this.newQuestion = '';
    }
  }
})

const generateResponse = async (newQuestion, setNewQuestion) => {
  const client = new OpenAIClient(
    openAiEndpoint,
    new AzureKeyCredential(azureApiKey)
  );
  const deploymentId = azureDeployment;

  const messages = [
    {
      role: "system",
      content:
      systemPrompt,
    },
    {
      role: "user",
      content: newQuestion,
    },
  ];

    try {
      const response = await client.getChatCompletions(
        deploymentId, // assumes a matching model deployment or model name
        messages
      );
      return response.choices[0].message.content;
    } catch (error) {
      console.log("error occured: ", error);
      console.log({ botResponse: error });
    }

};

</script>

<style type="text/css">

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

/* .answer-container {
  overflow: scroll;
  max-height: 500px;
} */

.answer-section {
  margin: 30px 0;
  position: relative;
  border-style: solid;
  border-color: #343536;
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
