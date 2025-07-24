---
marp: true
theme: default
paginate: true
---

# Kubernetes Web Communications Visualization Tool  
## How I went to this project  
- Using AI-enhanced 'VS Code' software (Cursor)  
- Believe in integration of AI tools  
- Started with personal projects  
- Wanted to find a use case for Kubernetes  

---

## How I thought of this project  
- Lack of "real" mapping of flows in IS: Who is calling who?  
- When an error appears… where?  
- Logs in our k8s clusters are normalized -> easy to understand in a cluster  
    - almost all logs are in json format, it's easy to parse and extract fields

---
## Features (Alpha/Beta)  
**What it covers:**  
- Detects webs communications between pods using pod IPs and access logs
    - identify internal and external calls
- Works with one or several k8s contexts
    - A node represents a namespace, or a source if not identified  
- Custom rules for log parsing  and IP identification
- Multi-threaded: parallelize namespaces analysis in threads to increase performance
- docker image and helm chart to deploy in a k8s cluster  

---
**Display and graphical usage:**  
- **HTTP error detection**: color-coded for 4xx/5xx errors  
- Sampling of 5xx errors  
- Tooltips on nodes (namespaces/sources) and edges (communications)  
- Filtering **by nodes** (highlight for easier visualization)  
- Filtering **by error codes**  
- Goodie: *Ant mode* 🐜  

---
## Why I think it is useful?  
- Having a graphical view of flows (Captain Obvious 🦸)  
- Identifying configuration inconsistencies  
    - internal calls with external urls
    - same host called with different http_host 
- Quickly locating errors  
- But must propose **another view and utility** compared with existing tools like ELK, grafana, loki, etc

---

## Limitations (so far)  

- Fetches **the last 'logs lines" for the last minute, every mn, per deployment/namespace**
    - more lines = More CPU  
    - more logs collections = More API calls
    - real time... = Fluentbit?
- Custom rules **hardcoded** -> Need YAML or other format 
    - inconsistencies in different configurations
- log format must be in json, with extractible fields
    - handle more log formats
    - However, **normalization is powerful**
- **No authentication (yet)**  

---

## Technical Enhancements
- extract and enrich with more informations (response_time, last MEP/release, etc)
- **Errors history with databases**  
- Make **custom rules easier** with config files ( get rid of custom rules within the code and normalization of logs format) 
- Add more IP rules to include **externals components**
- Separated and asynchronous systems for logs collections and analyzis
    - increase logs collection and buffering before analyzis
- Reduce API calls to k8s by building a enriched dictionnary
- code refactoring to ease comprehension:
    - python almost ok, but needs cleaning
    - separate js script

---
## Usage enhancements:
- Make filtering more efficient
- Improve or tune physics for more visibility
- add links in tooltips to another tool for details?
---

## Learnings and thinkings working with AI
- **GIT! GIT! (Did I say git?)**  
- AI tools can **boost efficiency**  
- AI helps with **initial setup**, but struggles with complexity 
    - we mustn't be lazy, asking too much can lead to more mess
    - bugs could appears very easily (AI does not remind and understand all the code it has produced before, or it's expensive! :) )
- **Think before using AI**: understand, correct, and guide the AI
- Easy to get lost → **Know and organize your code!**  

---

## Tools used:
- Cursor = VS Code powered with AI (with Anthropic/GPT4)
- LocalAI (local engine to provide LLMs internally)
    - less performant than "pro online models" like openAI/Anthropic/Gemini/Phi etc but nothing goes outside (models available gpt4, phi4, falcon, qwen2.5 (alibaba), stablediffusion, deepseek vX, etc)
    - ability to test several LLMs
- online AI tools

---
## Resources I want to explore:
- Customizing prompts
- Tools like k8sgpt, with custom filters
- LLM backdoor (not related to this project, just readings - tool to enrich an existing LLM - Training for logs?)
    - using the tool to customize a model => more a ML engineer job?
- https://medium.com/@rehmana.younis1/title-building-an-advanced-log-analyzer-chatbot-with-llms-rag-and-streamlit-8b8a203487c0
- https://mudler.pm/posts/localai-question-answering/
    - Chroma/LangChain/RAG (Retrieval-Augmented Generation) and localAI to analyse documents.
- security working with AI
    - despite the performance, that's why I used an internal server
- OASIS (Ollama Automated Security Intelligence Scanner) - scan the code for vulnerabilities
    - so far only with a local ollama, but could be integrated in CI



