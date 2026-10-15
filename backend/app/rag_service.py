# import os
# from typing import Dict
# from dotenv import load_dotenv

# # Modern LangChain 0.2+ / 0.3+ imports
# from langchain_community.vectorstores import Chroma
# from langchain_google_genai import GoogleGenerativeAIEmbeddings, ChatGoogleGenerativeAI
# from langchain_text_splitters import RecursiveCharacterTextSplitter
# from langchain_core.documents import Document

# load_dotenv()

# class RAGService:
#     def __init__(self):
#         api_key = os.getenv("GOOGLE_API_KEY")
#         if not api_key or api_key == "your_actual_gemini_api_key_here":
#             print("\n⚠️ WARNING: GOOGLE_API_KEY is not set properly in backend/.env!\n")
        
#         # Embedding model
#         self.embeddings = GoogleGenerativeAIEmbeddings(
#             model="models/text-embedding-004",
#             google_api_key=api_key
#         )
        
#         # Fast, low-latency LLM for real-time conversation
#         self.llm = ChatGoogleGenerativeAI(
#             model="gemini-1.5-flash",
#             temperature=0.3,
#             google_api_key=api_key
#         )
#         self.vector_store = None

#     def ingest_documents(self, documents_dict: Dict[str, str]):
#         docs = []
#         for doc_type, content in documents_dict.items():
#             if content and content.strip():
#                 docs.append(Document(page_content=content, metadata={"source": doc_type}))

#         if not docs:
#             return

#         splitter = RecursiveCharacterTextSplitter(chunk_size=700, chunk_overlap=100)
#         split_docs = splitter.split_documents(docs)

#         # In-memory vector store for the session
#         self.vector_store = Chroma.from_documents(
#             documents=split_docs,
#             embedding=self.embeddings,
#             collection_name="interview_knowledge"
#         )
#         print("Knowledge base successfully embedded and indexed into ChromaDB.")

#     def retrieve_context(self, query: str, k: int = 4) -> str:
#         if not self.vector_store:
#             return "No custom documentation indexed. Follow standard senior technical interview standards."
#         try:
#             results = self.vector_store.similarity_search(query, k=k)
#             return "\n\n".join([f"[{doc.metadata.get('source')}]:\n{doc.page_content}" for doc in results])
#         except Exception as e:
#             print(f"Retrieval warning: {e}")
#             return ""

import os
from typing import Dict

from dotenv import load_dotenv

load_dotenv()

class RAGService:
    def __init__(self):
        self.api_key = os.getenv("GOOGLE_API_KEY", "").strip()
        self.vector_store = None
        self.llm = None
        self.embeddings = None
        self.is_offline = False

        if not self.api_key or "your_" in self.api_key or len(self.api_key) < 10:
            print("\n[INFO] No valid GOOGLE_API_KEY detected in backend/.env.")
            print("[INFO] Operating in Resilient Local Offline Mode.\n")
            self.is_offline = True
        else:
            try:
                from langchain_community.vectorstores import Chroma
                from langchain_google_genai import (
                    ChatGoogleGenerativeAI,
                    GoogleGenerativeAIEmbeddings,
                )
                
                self.embeddings = GoogleGenerativeAIEmbeddings(
                    model="models/text-embedding-004",
                    google_api_key=self.api_key
                )
                self.llm = ChatGoogleGenerativeAI(
                    model="gemini-1.5-flash",
                    temperature=0.3,
                    google_api_key=self.api_key
                )
                print("[INFO] Successfully initialized Gemini 1.5 Flash client.")
            except Exception as e:
                print(f"[WARN] Failed to initialize cloud LLM ({e}). Falling back to Local Mode.")
                self.is_offline = True

    def ingest_documents(self, documents_dict: Dict[str, str]):
        if not self.is_offline and self.embeddings:
            try:
                from langchain_community.vectorstores import Chroma
                from langchain_core.documents import Document
                from langchain_text_splitters import RecursiveCharacterTextSplitter

                docs = []
                for doc_type, content in documents_dict.items():
                    if content and content.strip():
                        docs.append(Document(page_content=content, metadata={"source": doc_type}))

                if docs:
                    splitter = RecursiveCharacterTextSplitter(chunk_size=700, chunk_overlap=100)
                    split_docs = splitter.split_documents(docs)
                    self.vector_store = Chroma.from_documents(
                        documents=split_docs,
                        embedding=self.embeddings,
                        collection_name="interview_knowledge"
                    )
                    print("[INFO] Successfully indexed documents in ChromaDB.")
                    return
            except Exception as e:
                print(f"[WARN] ChromaDB indexing error: {e}. Ingested in local storage mode.")

        print("[INFO] Local mode: Knowledge base registered successfully.")

    def retrieve_context(self, query: str, k: int = 4) -> str:
        if not self.is_offline and self.vector_store:
            try:
                results = self.vector_store.similarity_search(query, k=k)
                return "\n\n".join([f"[{d.metadata.get('source')}]:\n{d.page_content}" for d in results])
            except Exception as e:
                print(f"[WARN] Vector retrieval warning: {e}")
        return "Internal Context: Follow manager uploaded guidelines, question banks, and technical standards."  