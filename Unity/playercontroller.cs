using UnityEngine;

public class PlayerController : MonoBehaviour {
    public float speed = 5f;

    void Update() {
        float moveX = Input.GetAxis("Horizontal") * speed * Time.deltaTime;
        float moveZ = Input.GetAxis("Vertical") * speed * Time.deltaTime;
        transform.Translate(moveX, 0, moveZ);
    }
}
