import os
import sys
import uvicorn

if __name__ == "__main__":
    print("🚀 Starting Aruba Switch Visual Manager on http://localhost:8085 ...")
    uvicorn.run("app.main:app", host="0.0.0.0", port=8085, reload=True)
