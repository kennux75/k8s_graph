---
marp: true
theme: default
paginate: true
---

# My Kubernetes Web Communications Visualization Tool  

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

---

## Features (Alpha/Beta)  
**What it covers:**  
- Detects web communications between pods using pod IPs & logs  
- Works with one or several k8s contexts  
- A node represents a namespace, or a source if not identified  
- Custom rules for log parsing  
- **HTTP error detection**: color-coded for 4xx/5xx errors  
- Sampling of 5xx errors  
- Tooltips on nodes (namespaces/sources) and edges (communications)  

**Display:**  
- Filtering by nodes  
- Filtering by error codes  
- **Goodie:** *Ant mode* 🐜  

---

## Why is this useful?  
- Having a graphical view of flows (Captain Obvious 🦸)  
- Identifying configuration inconsistencies  
- Quickly locating errors  

---

## Limitations (For Now)  
- **Multi-threaded**: Ensure thread results are OK (99% sure)  
- Fetches **500 log lines per pod/namespace** -> More pods/lines = More API calls & CPU  
- Custom rules **hardcoded** -> Need YAML or other format  
- **Display bugs**  
- **No authentication (yet!)**  

---

## Enhancements & Next Steps  
- Fix **graph refresh/update bugs**  
- Add **static physics** for better visualization  
- Improve **filtering (nodes/namespaces highlighting)**  
- **Error history with databases**  
- Make **custom rules easier** with config files  

---

## Learnings  
- **GIT! GIT! (Did I say GIT?)**  
- AI tools can **boost efficiency**  
- AI helps with **initial setup**, but struggles with complexity  
- **Think before using AI**: understand, correct, guide  
- Easy to get lost → **Know your code!**  

---

### Thank you!  
🚀 Questions? Feedback? Let's discuss!  

