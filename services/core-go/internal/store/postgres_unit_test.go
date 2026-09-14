package store

import (
	"context"
	"errors"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"
)

// These tests exercise LoadEventForRelease's error-wrapping branches
// directly against a fake querier — pgx.Rows is deliberately an interface
// "to allow tests to mock Query" (its own doc comment), and a real
// Postgres connection can't be made to fail mid-query on demand. New
// always calling QueryRow first, then Query three times in a fixed order,
// is what lets each fake below fail at exactly one step.

var errBoom = errors.New("boom")

type fakeRow struct {
	scanErr error
}

func (r fakeRow) Scan(dest ...any) error { return r.scanErr }

type fakeQuerier struct {
	row       pgx.Row
	queryErrs map[string]error // keyed by a substring of the SQL
	queryRows map[string]pgx.Rows
}

func (f *fakeQuerier) QueryRow(ctx context.Context, sql string, args ...any) pgx.Row {
	return f.row
}

func (f *fakeQuerier) Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error) {
	for substr, err := range f.queryErrs {
		if strings.Contains(sql, substr) {
			return nil, err
		}
	}
	for substr, rows := range f.queryRows {
		if strings.Contains(sql, substr) {
			return rows, nil
		}
	}
	return &fakeRows{}, nil
}

// fakeRows is a minimal pgx.Rows: empty by default, or yields scanErr on
// its one row when set.
type fakeRows struct {
	scanErr  error
	yielded  bool
	closeErr error
}

func (r *fakeRows) Close()                                       {}
func (r *fakeRows) Err() error                                   { return r.closeErr }
func (r *fakeRows) CommandTag() pgconn.CommandTag                { return pgconn.CommandTag{} }
func (r *fakeRows) FieldDescriptions() []pgconn.FieldDescription { return nil }
func (r *fakeRows) Next() bool {
	if r.scanErr == nil || r.yielded {
		return false
	}
	r.yielded = true
	return true
}
func (r *fakeRows) Scan(dest ...any) error { return r.scanErr }
func (r *fakeRows) Values() ([]any, error) { return nil, nil }
func (r *fakeRows) RawValues() [][]byte    { return nil }
func (r *fakeRows) Conn() *pgx.Conn        { return nil }
func (r *fakeRows) TypeMap() *pgtype.Map   { return nil }

func TestLoadEventForRelease_EventQueryError(t *testing.T) {
	pg := &Postgres{db: &fakeQuerier{row: fakeRow{scanErr: errBoom}}}
	_, err := pg.LoadEventForRelease(context.Background(), "e1")
	if err == nil || err == ErrNotFound {
		t.Fatalf("err = %v, want a wrapped non-ErrNotFound error", err)
	}
}

func TestLoadEventForRelease_NoRows(t *testing.T) {
	pg := &Postgres{db: &fakeQuerier{row: fakeRow{scanErr: pgx.ErrNoRows}}}
	_, err := pg.LoadEventForRelease(context.Background(), "e1")
	if err != ErrNotFound {
		t.Errorf("err = %v, want ErrNotFound", err)
	}
}

func TestLoadEventForRelease_JudgesQueryError(t *testing.T) {
	pg := &Postgres{db: &fakeQuerier{
		row:       fakeRow{},
		queryErrs: map[string]error{"FROM judges": errBoom},
	}}
	_, err := pg.LoadEventForRelease(context.Background(), "e1")
	if err == nil {
		t.Fatal("expected an error from the judges query")
	}
}

func TestLoadEventForRelease_PrizesQueryError(t *testing.T) {
	pg := &Postgres{db: &fakeQuerier{
		row:       fakeRow{},
		queryErrs: map[string]error{"FROM prizes": errBoom},
	}}
	_, err := pg.LoadEventForRelease(context.Background(), "e1")
	if err == nil {
		t.Fatal("expected an error from the prizes query")
	}
}

func TestLoadEventForRelease_TeamsQueryError(t *testing.T) {
	pg := &Postgres{db: &fakeQuerier{
		row:       fakeRow{},
		queryErrs: map[string]error{"FROM teams": errBoom},
	}}
	_, err := pg.LoadEventForRelease(context.Background(), "e1")
	if err == nil {
		t.Fatal("expected an error from the teams query")
	}
}

func TestLoadEventForRelease_TeamsScanError(t *testing.T) {
	pg := &Postgres{db: &fakeQuerier{
		row:       fakeRow{},
		queryRows: map[string]pgx.Rows{"FROM teams": &fakeRows{scanErr: errBoom}},
	}}
	_, err := pg.LoadEventForRelease(context.Background(), "e1")
	if err == nil {
		t.Fatal("expected an error from scanning team rows")
	}
}

func TestCollectTeams_RowsErr(t *testing.T) {
	_, err := collectTeams(&fakeRows{closeErr: errBoom})
	if err == nil {
		t.Fatal("expected rows.Err() to propagate")
	}
}
