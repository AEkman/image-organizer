package main

import (
	"encoding/json/v2"
	"errors"
	"mime"
	"net/http"
	"os"
	"path/filepath"
)

const maxDeleteFiles = 1000

type deleteRequest struct {
	Paths  []string `json:"paths"`
	DryRun *bool    `json:"dryRun"`
}
type deleteResult struct {
	Path   string `json:"path"`
	Status string `json:"status"`
	Error  string `json:"error,omitempty"`
}

func deleteHandler(move func(string) (string, error)) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Host != "localhost:8080" && r.Host != "127.0.0.1:8080" {
			http.Error(w, "Invalid local host", http.StatusForbidden)
			return
		}
		if origin := r.Header.Get("Origin"); origin != "" && origin != "http://"+r.Host {
			http.Error(w, "Cross-origin request denied", http.StatusForbidden)
			return
		}
		media, _, err := mime.ParseMediaType(r.Header.Get("Content-Type"))
		if err != nil || media != "application/json" {
			http.Error(w, "JSON required", http.StatusUnsupportedMediaType)
			return
		}
		var input deleteRequest
		if err := json.UnmarshalRead(http.MaxBytesReader(w, r.Body, 1<<20), &input, json.RejectUnknownMembers(true)); err != nil {
			http.Error(w, "Invalid deletion request", http.StatusBadRequest)
			return
		}
		if len(input.Paths) == 0 || len(input.Paths) > maxDeleteFiles {
			http.Error(w, "Choose 1–1000 rejected images", http.StatusBadRequest)
			return
		}
		dryRun := input.DryRun == nil || *input.DryRun
		results := []deleteResult{}
		seen := map[string]bool{}
		for _, p := range input.Paths {
			if seen[p] {
				continue
			}
			seen[p] = true
			result := deleteResult{Path: p, Status: "error"}
			if err := validateDeleteImage(p); err != nil {
				result.Error = err.Error()
			} else if dryRun {
				result.Status = "dry-run"
			} else if _, err := move(p); err != nil {
				result.Error = err.Error()
			} else {
				result.Status = "trashed"
			}
			results = append(results, result)
		}
		w.Header().Set("Content-Type", "application/json")
		if err := json.MarshalWrite(w, struct {
			Results []deleteResult `json:"results"`
		}{results}); err != nil {
			return
		}
	}
}
func validateDeleteImage(p string) error {
	if !filepath.IsAbs(p) || !supported(p) {
		return errors.New("Expected an absolute path to a supported image")
	}
	info, err := os.Lstat(p)
	if err != nil {
		return err
	}
	if !info.Mode().IsRegular() {
		return errors.New("Only regular image files can be trashed; folders and symlinks are excluded")
	}
	return nil
}
