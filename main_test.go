package main

import (
	"bytes"
	"encoding/json/v2"
	"errors"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestPage(t *testing.T) {
	r := httptest.NewRecorder()
	app().ServeHTTP(r, httptest.NewRequest("GET", "/", nil))
	if r.Code != 200 {
		t.Fatalf("page status = %d", r.Code)
	}
}

func TestFolder(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "photo.jpg"), []byte("image"), 0600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "notes.txt"), nil, 0600); err != nil {
		t.Fatal(err)
	}
	r := httptest.NewRecorder()
	app().ServeHTTP(r, httptest.NewRequest("GET", "/api/folder?path="+url.QueryEscape(dir), nil))
	if r.Code != 200 || !strings.Contains(r.Body.String(), "photo.jpg") || strings.Contains(r.Body.String(), "notes.txt") {
		t.Fatalf("unexpected listing: %d %s", r.Code, r.Body.String())
	}
}

func TestDeleteDefaultsToDryRun(t *testing.T) {
	p := filepath.Join(t.TempDir(), "photo.jpg")
	if err := os.WriteFile(p, []byte("photo"), 0600); err != nil {
		t.Fatal(err)
	}
	body, err := json.Marshal(map[string]any{"paths": []string{p}})
	if err != nil {
		t.Fatal(err)
	}
	request := httptest.NewRequest("POST", "http://localhost:8080/api/delete", bytes.NewReader(body))
	request.Header.Set("Content-Type", "application/json")
	response := httptest.NewRecorder()
	app().ServeHTTP(response, request)
	if response.Code != 200 || !strings.Contains(response.Body.String(), "dry-run") {
		t.Fatalf("unexpected response %d %s", response.Code, response.Body.String())
	}
	if _, err := os.Stat(p); err != nil {
		t.Fatalf("dry run changed original: %v", err)
	}
}

func TestNativeTrashMovesAndCanRestoreDisposableImage(t *testing.T) {
	p := filepath.Join(t.TempDir(), "image-organizer-disposable-test.jpg")
	if err := os.WriteFile(p, []byte("test-only"), 0600); err != nil {
		t.Fatal(err)
	}
	destination, err := trashFile(p)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if err := os.Rename(destination, p); err != nil {
			t.Errorf("restore disposable test file: %v", err)
		}
	})
	if _, err := os.Stat(p); !os.IsNotExist(err) {
		t.Fatalf("file still at source: %v", err)
	}
	data, err := os.ReadFile(destination)
	if err != nil || string(data) != "test-only" {
		t.Fatalf("trash contents: %q %v", data, err)
	}
}

func TestDeleteRejectsUnsafeRequestsAndTargets(t *testing.T) {
	p := filepath.Join(t.TempDir(), "photo.jpg")
	if err := os.WriteFile(p, nil, 0600); err != nil {
		t.Fatal(err)
	}
	for _, origin := range []string{"https://other.example", "null"} {
		body, _ := json.Marshal(map[string]any{"paths": []string{p}, "dryRun": false})
		request := httptest.NewRequest("POST", "http://localhost:8080/api/delete", bytes.NewReader(body))
		request.Header.Set("Content-Type", "application/json")
		request.Header.Set("Origin", origin)
		response := httptest.NewRecorder()
		deleteHandler(func(string) (string, error) { t.Fatal("unsafe move"); return "", nil })(response, request)
		if response.Code != 403 {
			t.Fatalf("origin %s accepted: %d", origin, response.Code)
		}
	}
	folder := filepath.Join(t.TempDir(), "directory.jpg")
	if err := os.Mkdir(folder, 0700); err != nil {
		t.Fatal(err)
	}
	link := filepath.Join(t.TempDir(), "link.jpg")
	if err := os.Symlink(p, link); err != nil {
		t.Fatal(err)
	}
	for _, target := range []string{folder, link, "relative.jpg", filepath.Join(t.TempDir(), "missing.jpg")} {
		if err := validateDeleteImage(target); err == nil {
			t.Fatalf("unsafe target accepted: %s", target)
		}
	}
}

func TestDeleteReportsPartialResultsAndDeduplicates(t *testing.T) {
	dir := t.TempDir()
	good := filepath.Join(dir, "good.jpg")
	bad := filepath.Join(dir, "bad.jpg")
	for _, p := range []string{good, bad} {
		if err := os.WriteFile(p, nil, 0600); err != nil {
			t.Fatal(err)
		}
	}
	calls := 0
	handler := deleteHandler(func(p string) (string, error) {
		calls++
		if p == bad {
			return "", errors.New("permission denied")
		}
		return filepath.Join(dir, "Trash"), nil
	})
	body, _ := json.Marshal(map[string]any{"paths": []string{good, bad, good}, "dryRun": false})
	request := httptest.NewRequest("POST", "http://localhost:8080/api/delete", bytes.NewReader(body))
	request.Header.Set("Content-Type", "application/json")
	response := httptest.NewRecorder()
	handler(response, request)
	var result struct {
		Results []deleteResult `json:"results"`
	}
	if err := json.Unmarshal(response.Body.Bytes(), &result); err != nil {
		t.Fatal(err)
	}
	if calls != 2 || len(result.Results) != 2 || result.Results[0].Status != "trashed" || result.Results[1].Status != "error" {
		t.Fatalf("partial result: %s (calls %d)", response.Body.String(), calls)
	}
}
