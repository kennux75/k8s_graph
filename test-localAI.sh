#! /bin/bash 

#curl -s http://xcompgpudv00u:8080/v1/chat/completions -H "Content-Type: application/json" -d '{
#     "model": "gpt-4",
#     "messages": [{"role": "user", "content": "How are you?"}],
#     "temperature": 0.9
#   }' | jq

#curl -s http://xcompgpudv00u:8080/v1/completions -H "Content-Type: application/json" -d '{
#     "model": "gpt-4",
#     "prompt": "you are a specialist in logs analysis. Your role is to extract clear information to help me finding errors",
#     "messages": [{"role": "user", "content": "Can you help me analysing json logs?"}],
#     "temperature": 0.9
#   }' | jq

curl http://xcompgpudv00u:8080/v1/files \
    -F purpose="user_data" \
    -F file="@/tmp/logs-extract.txt"

# curl "https://api.openai.com/v1/responses" \
#     -H "Content-Type: application/json" \
#     -H "Authorization: Bearer $OPENAI_API_KEY" \
#     -d '{
#         "model": "gpt-4o",
#         "input": [
#             {
#                 "role": "user",
#                 "content": [
#                     {
#                         "type": "input_file",
#                         "file_id": "file-6F2ksmvXxt4VdoqmHRw6kL"
#                     },
#                     {
#                         "type": "input_text",
#                         "text": "What is the first dragon in the book?"
#                     }
#                 ]
#             }
#         ]
#     }'
