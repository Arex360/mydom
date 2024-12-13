package main

import (
	"crypto/md5"
	"encoding/hex"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

var projectFiles = make(map[string]FileData)
var mu sync.Mutex

// FileData holds the file path and its MD5 hash
type FileData struct {
	Path string `json:"path"`
	MD5  string `json:"md5"`
}

// CalculateMD5 calculates the MD5 hash of a file
func CalculateMD5(filePath string) string {
	file, err := os.Open(filePath)
	if err != nil {
		fmt.Println("Error opening file:", err)
		return ""
	}
	defer file.Close()

	hash := md5.New()
	if _, err := io.Copy(hash, file); err != nil {
		fmt.Println("Error calculating hash:", err)
		return ""
	}

	return hex.EncodeToString(hash.Sum(nil))
}

// TraverseDirectory recursively traverses the directory and calculates file hashes
func TraverseDirectory(dirPath string, fileHashData map[string]FileData) {
	files, err := os.ReadDir(dirPath)
	if err != nil {
		fmt.Println("Error reading directory:", err)
		return
	}

	for _, file := range files {
		fullPath := filepath.Join(dirPath, file.Name())
		if file.IsDir() {
			// Skip node_modules and .git directories
			if file.Name() == "node_modules" || file.Name() == ".git" {
				continue
			}
			TraverseDirectory(fullPath, fileHashData)
		} else {
			// Calculate hash for each file
			if strings.Contains(fullPath, "dominance.zip") || strings.Contains(fullPath, ".gitignore") {
				continue
			}
			hash := CalculateMD5(fullPath)
			localPath, _ := filepath.Rel(".", fullPath)
			fileHashData[file.Name()] = FileData{
				Path: localPath,
				MD5:  hash,
			}
		}
	}
}

// GenerateFileHashes generates the file hash data and writes it to a file
func GenerateFileHashes() {
	fileHashData := make(map[string]FileData)
	TraverseDirectory(".", fileHashData)

	// Write to file_hash.json
	file, err := os.Create("file_hash.json")
	if err != nil {
		fmt.Println("Error creating file:", err)
		return
	}
	defer file.Close()

	// Serialize the fileHashData (we can use JSON encoding if necessary)
	for filename, data := range fileHashData {
		fmt.Fprintf(file, "File: %s, Path: %s, MD5: %s\n", filename, data.Path, data.MD5)
	}
	fmt.Println("File hash data saved to file_hash.json")
}

// ServeDownload handles the /download endpoint
func ServeDownload(w http.ResponseWriter, r *http.Request) {
	filename := r.URL.Query().Get("filename")
	if filename == "" {
		http.Error(w, "Filename query parameter is required", http.StatusBadRequest)
		return
	}

	// Lock and refresh file hashes on each download request
	mu.Lock()
	defer mu.Unlock()

	fileHashData := make(map[string]FileData)
	TraverseDirectory(".", fileHashData)

	// Check if the file exists in the updated file_hash data
	fileData, exists := fileHashData[filename]
	if !exists {
		http.Error(w, "File not found", http.StatusNotFound)
		return
	}

	filePath := filepath.Join(".", fileData.Path)

	// Check if the file exists on the filesystem
	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		http.Error(w, "File no longer exists on the server", http.StatusNotFound)
		return
	}

	// Set headers and send the file for download
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=%s", filename))
	http.ServeFile(w, r, filePath)
}

// VerifyMD5 handles the /verify endpoint
func VerifyMD5(w http.ResponseWriter, r *http.Request) {
	filename := r.URL.Query().Get("filename")
	md5Hash := r.URL.Query().Get("md5")

	if filename == "" || md5Hash == "" {
		http.Error(w, "Filename and md5 query parameters are required", http.StatusBadRequest)
		return
	}

	// Lock and refresh file hashes on each verify request
	mu.Lock()
	defer mu.Unlock()

	fileHashData := make(map[string]FileData)
	TraverseDirectory(".", fileHashData)

	// Check if the file exists in the updated file_hash data
	fileData, exists := fileHashData[filename]
	if !exists {
		http.Error(w, "File not found", http.StatusNotFound)
		return
	}

	// Compare the provided MD5 hash with the actual file's MD5 hash
	if fileData.MD5 == md5Hash {
		w.Write([]byte("MD5 hash matches"))
	} else {
		http.Error(w, "MD5 hash does not match", http.StatusBadRequest)
	}
}

func main() {
	// Call the function to generate file hash data at server startup
	GenerateFileHashes()

	// Set up routes
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("done"))
	})
	http.HandleFunc("/download", ServeDownload)
	http.HandleFunc("/verify", VerifyMD5)

	// Start the server
	fmt.Println("Server started on port 3003")
	if err := http.ListenAndServe(":3003", nil); err != nil {
		fmt.Println("Error starting server:", err)
	}
}
