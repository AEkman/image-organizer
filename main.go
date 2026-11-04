package main

import (
	"embed"
	"encoding/json/v2"
	"io/fs"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
)

//go:embed web
var assets embed.FS

func app() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/folder", folder)
	mux.HandleFunc("POST /api/delete", deleteHandler(trashFile))
	mux.HandleFunc("GET /api/image", imageFile)
	mux.Handle("GET /", http.FileServerFS(mustWeb()))
	return mux
}

func main() {
	log.Print("Image organizer: http://localhost:8080")
	log.Fatal(http.ListenAndServe("127.0.0.1:8080", app()))
}

func mustWeb() fs.FS {
	sub, err := fs.Sub(assets, "web")
	if err != nil {
		panic(err)
	}
	return sub
}

type entry struct {
	Name   string `json:"name"`
	Path   string `json:"path"`
	Folder bool   `json:"folder"`
}

func resolve(p string) (string, error) {
	if p == "" || p == "~" || strings.HasPrefix(p, "~/") {
		home, err := os.UserHomeDir()
		if err != nil {
			return "", err
		}
		p = filepath.Join(home, strings.TrimPrefix(strings.TrimPrefix(p, "~"), "/"))
	}
	return filepath.Abs(p)
}
func supported(p string) bool {
	switch strings.ToLower(filepath.Ext(p)) {
	case ".jpg", ".jpeg", ".png", ".webp", ".gif":
		return true
	}
	return false
}
func folder(w http.ResponseWriter, r *http.Request) {
	p, err := resolve(r.URL.Query().Get("path"))
	if err != nil {
		http.Error(w, "Invalid path", 400)
		return
	}
	files, err := os.ReadDir(p)
	if err != nil {
		http.Error(w, "Cannot open folder: "+err.Error(), 400)
		return
	}
	entries := []entry{}
	for _, f := range files {
		if f.Type()&os.ModeSymlink != 0 {
			continue
		}
		if f.IsDir() || supported(f.Name()) {
			entries = append(entries, entry{f.Name(), filepath.Join(p, f.Name()), f.IsDir()})
		}
	}
	w.Header().Set("Content-Type", "application/json")
	json.MarshalWrite(w, struct {
		Path    string  `json:"path"`
		Parent  string  `json:"parent"`
		Entries []entry `json:"entries"`
	}{p, filepath.Dir(p), entries})
}
func imageFile(w http.ResponseWriter, r *http.Request) {
	p, err := resolve(r.URL.Query().Get("path"))
	if err != nil || !supported(p) {
		http.NotFound(w, r)
		return
	}
	f, err := os.Open(p)
	if err != nil {
		http.NotFound(w, r)
		return
	}
	defer f.Close()
	info, err := f.Stat()
	if err != nil || !info.Mode().IsRegular() {
		http.NotFound(w, r)
		return
	}
	w.Header().Set("X-Content-Type-Options", "nosniff")
	http.ServeContent(w, r, info.Name(), info.ModTime(), f)
}
