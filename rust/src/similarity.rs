//! State matrix similarity detection
//!
//! Builds 57×72 state transition matrices from AST
//! and calculates cosine similarity between them.

use ndarray::Array2;

const NUM_SYNTAX: usize = 57;
const NUM_STATES: usize = 72;

/// Build a 57×72 state transition matrix from source code
pub fn build_state_matrix(source: &str) -> Array2<u8> {
    let mut matrix = Array2::<u8>::zeros((NUM_SYNTAX, NUM_STATES));

    // Parse with tree-sitter
    let mut parser = tree_sitter::Parser::new();
    let language = tree_sitter_typescript::language_typescript();
    if parser.set_language(&language).is_err() {
        return matrix;
    }

    let tree = match parser.parse(source, None) {
        Some(t) => t,
        None => return matrix,
    };
    let root = tree.root_node();

    // Walk AST and count transitions
    walk_node(&root, None, &mut matrix);

    matrix
}

fn walk_node(node: &tree_sitter::Node, parent_kind: Option<u16>, matrix: &mut Array2<u8>) {
    let node_kind = node.kind_id() as usize;

    // Map tree-sitter kind to our state index
    if let Some(parent) = parent_kind {
        let parent_idx = map_kind_to_index(parent as usize);
        let node_idx = map_kind_to_index(node_kind);

        if parent_idx < NUM_SYNTAX && node_idx < NUM_STATES {
            let current = matrix[[parent_idx, node_idx]];
            if current < 255 {
                matrix[[parent_idx, node_idx]] = current + 1;
            }
        }
    }

    // Recurse to children
    let cursor = &mut node.walk();
    for child in node.children(cursor) {
        walk_node(&child, Some(node.kind_id()), matrix);
    }
}

/// Map tree-sitter kind_id to our compact state index
fn map_kind_to_index(kind: usize) -> usize {
    // Simplified mapping - in production, use a proper lookup table
    // based on TypeScript AST node types
    kind % NUM_STATES
}

/// Calculate cosine similarity between two state matrices
pub fn calculate_similarity(m1: &Array2<u8>, m2: &Array2<u8>) -> f32 {
    let p1 = to_probability_matrix(m1);
    let p2 = to_probability_matrix(m2);

    let mut total_similarity = 0.0;
    let mut valid_rows = 0;

    for i in 0..NUM_SYNTAX {
        let row1 = p1.row(i);
        let row2 = p2.row(i);

        // Skip empty rows
        let has_data1 = row1.iter().any(|&v| v > 0.0);
        let has_data2 = row2.iter().any(|&v| v > 0.0);

        if has_data1 || has_data2 {
            let sim = cosine_similarity(row1.as_slice().unwrap(), row2.as_slice().unwrap());
            total_similarity += sim;
            valid_rows += 1;
        }
    }

    if valid_rows == 0 {
        return 0.0;
    }

    total_similarity / valid_rows as f32
}

fn to_probability_matrix(matrix: &Array2<u8>) -> Array2<f32> {
    let mut result = Array2::<f32>::zeros(matrix.raw_dim());

    for i in 0..NUM_SYNTAX {
        let row = matrix.row(i);
        let sum: u32 = row.iter().map(|&v| v as u32).sum();

        if sum > 0 {
            let mut prob_row = result.row_mut(i);
            for (j, &val) in row.iter().enumerate() {
                prob_row[j] = val as f32 / sum as f32;
            }
        }
    }

    result
}

fn cosine_similarity(a: &[f32], b: &[f32]) -> f32 {
    let mut dot_product = 0.0;
    let mut norm_a = 0.0;
    let mut norm_b = 0.0;

    for i in 0..a.len() {
        dot_product += a[i] * b[i];
        norm_a += a[i] * a[i];
        norm_b += b[i] * b[i];
    }

    if norm_a == 0.0 || norm_b == 0.0 {
        return 0.0;
    }

    dot_product / (norm_a.sqrt() * norm_b.sqrt())
}

/// Count non-zero transitions (proxy for complexity)
pub fn count_transitions(matrix: &Array2<u8>) -> usize {
    matrix.iter().filter(|&&v| v > 0).count()
}

/// Check if function meets complexity threshold
pub fn is_complex_enough(matrix: &Array2<u8>, min_transitions: usize) -> bool {
    count_transitions(matrix) >= min_transitions
}

#[cfg(test)]
mod tests {
    use super::*;

    const TEST_FUNCTION_1: &str = r#"
function calculateSum(a: number, b: number): number {
    if (a < 0 || b < 0) {
        throw new Error("Negative numbers not allowed");
    }
    return a + b;
}
"#;

    const TEST_FUNCTION_2: &str = r#"
function addValues(x: number, y: number): number {
    if (x < 0 || y < 0) {
        throw new Error("Invalid input");
    }
    return x + y;
}
"#;

    #[test]
    fn test_build_matrix_has_correct_dimensions() {
        let matrix = build_state_matrix(TEST_FUNCTION_1);
        assert_eq!(matrix.shape(), &[57, 72]);
    }

    #[test]
    fn test_similar_high_for_similar_functions() {
        let m1 = build_state_matrix(TEST_FUNCTION_1);
        let m2 = build_state_matrix(TEST_FUNCTION_2);

        let similarity = calculate_similarity(&m1, &m2);

        // Similar functions should have > 60% similarity
        assert!(similarity > 0.60, "Expected > 0.60, got {}", similarity);
    }

    #[test]
    fn test_similarity_is_symmetric() {
        let m1 = build_state_matrix(TEST_FUNCTION_1);
        let m2 = build_state_matrix(TEST_FUNCTION_2);

        let sim1 = calculate_similarity(&m1, &m2);
        let sim2 = calculate_similarity(&m2, &m1);

        assert!((sim1 - sim2).abs() < 0.001);
    }

    #[test]
    fn test_identical_functions_have_100_similarity() {
        let m1 = build_state_matrix(TEST_FUNCTION_1);
        let m2 = build_state_matrix(TEST_FUNCTION_1);

        let similarity = calculate_similarity(&m1, &m2);

        assert!((similarity - 1.0).abs() < 0.001);
    }
}
