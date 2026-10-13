from fastapi import FastAPI

app=FastAPI()

@app.get('/')
def home():
    print("system working")
    return{"message":"system working"}


    